import { Order } from '@/types';
import { env } from '../config/env';
import { getAccountFieldInfo, formatPaymentDisplayForWhatsApp, getGameDeliveryConfig } from '../chat/input-parser';

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface WhatsAppButton {
  id: string;
  title: string;
}

export interface WhatsAppListRow {
  id: string;
  title: string;
  description?: string;
}

export interface WhatsAppListSection {
  title?: string;
  rows: WhatsAppListRow[];
}

/**
 * Helper to record automated bot notifications into conversation history
 */
async function logBotMessageToConversation(phone: string, text: string, metadata?: Record<string, any>) {
  try {
    const { chatRepository } = await import('../db/repositories/chat');
    const conv = await chatRepository.getOrCreateConversation(phone);
    if (conv?.id) {
      await chatRepository.addMessage({
        conversationId: conv.id,
        sender: 'BOT',
        content: text,
        metadata: metadata || {}
      });
    }
  } catch (err) {
    console.warn('[WhatsApp logBotMessageToConversation error]:', err);
  }
}

export const whatsappService = {
  /**
   * Send a free-form text message to customer's WhatsApp via Meta Cloud API
   */
  async sendMessage(toPhone: string, text: string): Promise<SendMessageResult> {
    const cleanPhone = toPhone.replace(/\D/g, '');

    if (!env.whatsapp.isConfigured) {
      const errorMsg = 'WhatsApp Cloud API credentials not configured in environment';
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    try {
      const response = await fetch(`${env.whatsapp.apiUrl}/${env.whatsapp.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.whatsapp.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'text',
          text: { preview_url: false, body: text },
        }),
      });

      const data = await response.json();
      if (response.ok && data.messages?.[0]?.id) {
        return { success: true, messageId: data.messages[0].id };
      }
      console.error('WhatsApp API Error:', data);
      return { success: false, error: JSON.stringify(data) };
    } catch (err) {
      console.error('WhatsApp API Network Exception:', err);
      return { success: false, error: String(err) };
    }
  },

  /**
   * Send an interactive Quick Reply Buttons message (up to 3 buttons) via Meta Cloud API
   */
  async sendInteractiveButtons(
    toPhone: string,
    bodyText: string,
    buttons: WhatsAppButton[],
    headerText?: string,
    footerText = 'DS Dukan — 24/7 Gaming Shop'
  ): Promise<SendMessageResult> {
    const cleanPhone = toPhone.replace(/\D/g, '');
    const validButtons = buttons.slice(0, 3).map((b, idx) => ({
      type: 'reply',
      reply: {
        id: b.id || `btn_${idx}`,
        title: b.title.slice(0, 20) // WhatsApp limit is 20 chars per button title
      }
    }));

    if (!env.whatsapp.isConfigured) {
      const errorMsg = 'WhatsApp Cloud API credentials not configured in environment';
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    try {
      const payload: Record<string, any> = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: bodyText },
          footer: { text: footerText },
          action: { buttons: validButtons }
        }
      };

      if (headerText) {
        payload.interactive.header = { type: 'text', text: headerText };
      }

      const response = await fetch(`${env.whatsapp.apiUrl}/${env.whatsapp.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.whatsapp.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (response.ok && data.messages?.[0]?.id) {
        return { success: true, messageId: data.messages[0].id };
      }
      console.error('WhatsApp Interactive Button API Error:', JSON.stringify(data));
      console.log(`[WhatsApp Fallback] Sending plain text message to ${cleanPhone}...`);
      return await this.sendMessage(toPhone, bodyText);
    } catch (err) {
      console.error('WhatsApp Interactive Button Network Exception:', err);
      return await this.sendMessage(toPhone, bodyText);
    }
  },

  /**
   * Send an interactive List message (up to 10 options) via Meta Cloud API
   */
  async sendInteractiveList(
    toPhone: string,
    bodyText: string,
    buttonLabel: string,
    sections: WhatsAppListSection[],
    headerText?: string,
    footerText = 'DS Dukan — 24/7 Gaming Shop'
  ): Promise<SendMessageResult> {
    const cleanPhone = toPhone.replace(/\D/g, '');

    if (!env.whatsapp.isConfigured) {
      const errorMsg = 'WhatsApp Cloud API credentials not configured in environment';
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    try {
      const formattedSections = sections.map((sec, sIdx) => ({
        title: (sec.title || `Category ${sIdx + 1}`).slice(0, 24),
        rows: sec.rows.map((row, rIdx) => ({
          id: row.id || `row_${sIdx}_${rIdx}`,
          title: row.title.slice(0, 24),
          description: row.description ? row.description.slice(0, 72) : undefined
        }))
      }));

      const payload: Record<string, any> = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: bodyText },
          footer: { text: footerText },
          action: {
            button: buttonLabel.slice(0, 20),
            sections: formattedSections
          }
        }
      };

      if (headerText) {
        payload.interactive.header = { type: 'text', text: headerText.slice(0, 60) };
      }

      const response = await fetch(`${env.whatsapp.apiUrl}/${env.whatsapp.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.whatsapp.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (response.ok && data.messages?.[0]?.id) {
        return { success: true, messageId: data.messages[0].id };
      }
      console.error('WhatsApp Interactive List API Error:', JSON.stringify(data));
      console.log(`[WhatsApp Fallback] Sending plain text message to ${cleanPhone}...`);
      return await this.sendMessage(toPhone, bodyText);
    } catch (err) {
      console.error('WhatsApp Interactive List Network Exception:', err);
      return await this.sendMessage(toPhone, bodyText);
    }
  },

  /**
   * Send structured Order Confirmation notification to customer with buttons
   */
  async sendOrderConfirmation(order: Order): Promise<SendMessageResult> {
    const firstItem = order.items?.[0];
    const itemsList = order.items?.map(i => `• ${i.product_name} x ${i.quantity} = ৳${i.subtotal}`).join('\n') || '';
    const playerUid = order.player_uid || order.delivery_address?.name || 'N/A';
    
    const gameTitle = 
      order.customer_notes?.match(/Game:\s*([^|\n]+)/i)?.[1]?.trim() || 
      firstItem?.product_name || 
      '';

    const accountInfo = getAccountFieldInfo(playerUid, gameTitle);
    const paymentDisplay = formatPaymentDisplayForWhatsApp(order.trx_id, order.payment_method);
    const deliveryConfig = getGameDeliveryConfig(gameTitle, firstItem?.product_name);
    
    const messageText = 
`🎉 *অর্ডার নিশ্চিতকরণ / Order Confirmed!*

প্রিয় গ্রাহক, আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে।

📦 *Order ID:* \`${order.order_id}\`
${accountInfo.emoji} *${accountInfo.labelBn}:* \`${playerUid}\`
💰 *মোট মূল্য (Total):* ৳${order.total_amount}
💳 *পেমেন্ট:* ${paymentDisplay}
⚡ *ডেলিভারি সময়:* ৫–১৫ মিনিট (5-15 Minutes)

*প্যাকেজসমূহ (Packages):*
${itemsList}

${deliveryConfig.deliveryMessage}

🎮 *অন্য কোনো গেম বা সাবস্ক্রিপশন (Movie, Free Fire, eFootball ইত্যাদি) নিতে নিচে 'সব সার্ভিস ও গেম' বাটনে চাপ দিন:*`;

    const buttons: WhatsAppButton[] = [
      { id: 'btn_main_menu', title: '🎮 সব সার্ভিস ও গেম' },
      { id: `track:${order.order_id}`, title: '📦 অর্ডার ট্র্যাক' },
      { id: 'btn_website', title: '🌐 ওয়েবসাইট (২% ছাড়)' }
    ];

    logBotMessageToConversation(order.delivery_phone, messageText, {
      type: 'ORDER_CONFIRMATION',
      orderId: order.order_id,
      amount: order.total_amount
    });

    return this.sendInteractiveButtons(order.delivery_phone, messageText, buttons, 'DS Dukan Top-Up');
  },

  /**
   * Send Order Claimed by Worker notification
   */
  async sendOrderClaimedNotification(order: Order, workerName: string): Promise<SendMessageResult> {
    const firstItem = order.items?.[0];
    const gameTitle = 
      order.customer_notes?.match(/Game:\s*([^|\n]+)/i)?.[1]?.trim() || 
      firstItem?.product_name || 
      '';
    const playerUid = order.player_uid || order.delivery_address?.name || 'N/A';
    const accountInfo = getAccountFieldInfo(playerUid, gameTitle);

    const messageText = 
`⚡ *অর্ডার আপডেট / Order Processing!*

আপনার অর্ডার *#${order.order_id}* (${playerUid}) প্রসেসিং শুরু হয়েছে।
আমাদের কর্মী *${workerName}* আপনার অর্ডারে কাজ করছেন (সময় ৫–১৫ মিনিট)।`;

    const buttons: WhatsAppButton[] = [
      { id: `track:${order.order_id}`, title: '📦 লাইভ স্ট্যাটাস' },
      { id: 'btn_main_menu', title: '🎮 সব সার্ভিস ও গেম' }
    ];

    logBotMessageToConversation(order.delivery_phone, messageText, {
      type: 'ORDER_CLAIMED',
      orderId: order.order_id,
      worker: workerName
    });

    return this.sendInteractiveButtons(order.delivery_phone, messageText, buttons, 'DS Dukan Update');
  },

  /**
   * Send Order Delivered & Completed notification
   */
  async sendOrderDeliveredNotification(order: Order): Promise<SendMessageResult> {
    const firstItem = order.items?.[0];
    const gameTitle = 
      order.customer_notes?.match(/Game:\s*([^|\n]+)/i)?.[1]?.trim() || 
      firstItem?.product_name || 
      '';
    const playerUid = order.player_uid || order.delivery_address?.name || 'N/A';
    const accountInfo = getAccountFieldInfo(playerUid, gameTitle);

    const fullOrderContext = `${gameTitle} ${firstItem?.product_name || ''} ${order.customer_notes || ''}`.toLowerCase();
    const isEfootball =
      fullOrderContext.includes('efootball') ||
      fullOrderContext.includes('efb') ||
      fullOrderContext.includes('konami');

    const isYouTube = fullOrderContext.includes('youtube');

    let completionNote = `আপনার আইডিতে টপ-আপ যুক্ত করা হয়েছে।`;
    if (accountInfo.isEmail) {
      completionNote = `আপনার সাবস্ক্রিপশন চালু করে অ্যাকাউন্ট/লগইন তথ্য সফলভাবে সরবরাহ করা হয়েছে।`;
    }

    let orderDetailsText = `প্রিয় গ্রাহক, আপনার অর্ডার *#${order.order_id}* (${playerUid}) সফলভাবে সম্পন্ন হয়েছে এবং ${completionNote} ✨`;

    if (isEfootball) {
      orderDetailsText = 
`প্রিয় গ্রাহক, আপনার অর্ডার *#${order.order_id}* (${playerUid}) সফলভাবে সম্পন্ন হয়েছে এবং আপনার টপ-আপ সফলভাবে সম্পন্ন হয়েছে।

🔒 *নিরাপত্তার জন্য আপনি অবশ্যই আপনার পাসওয়ার্ড পরিবর্তন করে নিবেন।* ✨`;
    } else if (isYouTube) {
      orderDetailsText = 
`প্রিয় গ্রাহক, আপনার অর্ডার *#${order.order_id}* (${playerUid}) সফলভাবে সম্পন্ন হয়েছে এবং আপনার YouTube Premium সাবস্ক্রিপশন চালু করা হয়েছে। ✨

📩 *অনুগ্রহ করে আপনার Gmail ইনবক্স বা স্প্যাম ফোল্ডার চেক করে ইনভাইটেশন এক্সেপ্ট করে নিন।* ❤️`;
    }

    const messageText = 
`✅ *অর্ডার সফলভাবে সম্পন্ন হয়েছে / Order Delivered!*

${orderDetailsText}

DS Dukan থেকে কেনাকাটা করার জন্য ধন্যবাদ! ❤️
ওয়েবসাইটে ২% ডিসকাউন্টে সরাসরি কিনতে ভিজিট করুন: https://www.dsdukan.com/#

🎮 *অন্য কোনো গেম বা সাবস্ক্রিপশন নিতে নিচের মেনু বাটনে চাপ দিন:*`;

    const buttons: WhatsAppButton[] = [
      { id: 'btn_main_menu', title: '🎮 সব সার্ভিস ও গেম' },
      { id: `track:${order.order_id}`, title: '📦 অর্ডার সামারি' },
      { id: 'btn_website', title: '🌐 ওয়েবসাইট' }
    ];

    logBotMessageToConversation(order.delivery_phone, messageText, {
      type: 'ORDER_DELIVERED',
      orderId: order.order_id
    });

    return this.sendInteractiveButtons(order.delivery_phone, messageText, buttons, 'DS Dukan Success');
  },

  /**
   * Send Order Cancelled notification to customer
   */
  async sendOrderCancelledNotification(order: Order, reason?: string): Promise<SendMessageResult> {
    const firstItem = order.items?.[0];
    const gameTitle = 
      order.customer_notes?.match(/Game:\s*([^|\n]+)/i)?.[1]?.trim() || 
      firstItem?.product_name || 
      '';
    const playerUid = order.player_uid || order.delivery_address?.name || 'N/A';

    const messageText = 
`❌ *অর্ডার বাতিল করা হয়েছে / Order Cancelled*

প্রিয় গ্রাহক, আপনার অর্ডার *#${order.order_id}* (${playerUid}) বাতিল করা হয়েছে।
${reason ? `\n📌 *কারণ / Reason:* ${reason}` : ''}
💰 *মোট মূল্য:* ৳${order.total_amount}

কোনো জিজ্ঞাসা বা সহায়তার জন্য আমাদের ইনবক্সে মেসেজ দিন অথবা ভিজিট করুন: https://www.dsdukan.com/#`;

    const buttons: WhatsAppButton[] = [
      { id: 'btn_main_menu', title: '🎮 সব সার্ভিস ও গেম' },
      { id: 'btn_website', title: '🌐 ওয়েবসাইট ২% ছাড়' }
    ];

    logBotMessageToConversation(order.delivery_phone, messageText, {
      type: 'ORDER_CANCELLED',
      orderId: order.order_id,
      reason
    });

    return this.sendInteractiveButtons(order.delivery_phone, messageText, buttons, 'DS Dukan Support');
  },

  /**
   * Mark incoming message as seen (blue ticks) via WhatsApp Cloud API
   */
  async markAsRead(messageId: string): Promise<boolean> {
    if (!env.whatsapp.isConfigured || !messageId) {
      return false;
    }

    try {
      const response = await fetch(`${env.whatsapp.apiUrl}/${env.whatsapp.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.whatsapp.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        }),
      });

      const data = await response.json();
      return response.ok && Boolean(data.success);
    } catch (err) {
      console.warn('[WhatsApp markAsRead Error]:', err);
      return false;
    }
  },

  /**
   * Upload media buffer to Meta WhatsApp Media endpoint and get a media_id
   */
  async uploadMedia(
    imageBuffer: ArrayBuffer | Buffer | Uint8Array,
    mimeType = 'image/jpeg',
    filename = 'qr_code.jpg'
  ): Promise<{ success: boolean; mediaId?: string; error?: string }> {
    if (!env.whatsapp.isConfigured) {
      const errorMsg = 'WhatsApp Cloud API credentials not configured in environment';
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    try {
      const formData = new FormData();
      const blob = new Blob([imageBuffer as any], { type: mimeType });
      formData.append('file', blob, filename);
      formData.append('type', mimeType);
      formData.append('messaging_product', 'whatsapp');

      const response = await fetch(`${env.whatsapp.apiUrl}/${env.whatsapp.phoneNumberId}/media`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.whatsapp.accessToken}`,
        },
        body: formData,
      });

      const data = await response.json();
      if (response.ok && data.id) {
        console.log(`[WhatsApp Media Upload] Successfully uploaded media, media_id: ${data.id}`);
        return { success: true, mediaId: data.id };
      }
      console.error('[WhatsApp Media Upload Error]:', JSON.stringify(data));
      return { success: false, error: JSON.stringify(data) };
    } catch (err) {
      console.error('[WhatsApp Media Upload Exception]:', err);
      return { success: false, error: String(err) };
    }
  },

  /**
   * Send an image with optional caption to customer's WhatsApp
   * Automatically handles direct image URLs, Telegram file URLs (by downloading & uploading to Meta), and raw buffers.
   */
  async sendImage(
    toPhone: string,
    imageSource: string | ArrayBuffer | Buffer,
    caption?: string
  ): Promise<SendMessageResult> {
    const cleanPhone = toPhone.replace(/\D/g, '');

    if (!env.whatsapp.isConfigured) {
      const errorMsg = 'WhatsApp Cloud API credentials not configured in environment';
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    try {
      let mediaId: string | undefined;

      // 1. If imageSource is a buffer / ArrayBuffer
      if (typeof imageSource !== 'string') {
        const uploadRes = await this.uploadMedia(imageSource, 'image/jpeg', 'image.jpg');
        if (uploadRes.success && uploadRes.mediaId) {
          mediaId = uploadRes.mediaId;
        }
      } else if (typeof imageSource === 'string' && imageSource.startsWith('http')) {
        // 2. If imageSource is an external URL (e.g. Telegram file URL), download to buffer first and upload to Meta
        try {
          console.log(`[WhatsApp sendImage] Fetching image from URL: ${imageSource.slice(0, 45)}...`);
          const imgFetch = await fetch(imageSource, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          if (imgFetch.ok) {
            const buffer = await imgFetch.arrayBuffer();
            const uploadRes = await this.uploadMedia(buffer, 'image/jpeg', 'qr_code.jpg');
            if (uploadRes.success && uploadRes.mediaId) {
              mediaId = uploadRes.mediaId;
            }
          }
        } catch (fetchErr) {
          console.warn('[WhatsApp sendImage Fetch Error]: Could not pre-upload buffer, will try link fallback:', fetchErr);
        }
      }

      const payload: Record<string, any> = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'image',
        image: mediaId
          ? { id: mediaId, ...(caption ? { caption } : {}) }
          : { link: imageSource, ...(caption ? { caption } : {}) }
      };

      console.log(`[WhatsApp sendImage] Dispatching image payload (Mode: ${mediaId ? `media_id (${mediaId})` : 'direct_link'}) to ${cleanPhone}...`);

      const response = await fetch(`${env.whatsapp.apiUrl}/${env.whatsapp.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.whatsapp.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (response.ok && data.messages?.[0]?.id) {
        console.log(`[WhatsApp sendImage Success] Message ID: ${data.messages[0].id}`);
        return { success: true, messageId: data.messages[0].id };
      }
      console.error('[WhatsApp Send Image API Error]:', JSON.stringify(data));
      return { success: false, error: JSON.stringify(data) };
    } catch (err) {
      console.error('[WhatsApp Send Image Network Exception]:', err);
      return { success: false, error: String(err) };
    }
  },

  /**
   * Send PUBG Login QR Code prompt to customer with interactive buttons (Done & Need New QR)
   */
  async sendQrCodePrompt(
    toPhone: string,
    imageUrl: string,
    orderId: string,
    packageName?: string
  ): Promise<SendMessageResult> {
    const cleanPhone = toPhone.replace(/\D/g, '');

    const caption = 
`📲 *PUBG Mobile Login QR Code / লগইন কিউআর কোড*

📦 *অর্ডার আইডি:* \`#${orderId}\`${packageName ? `\n💎 *প্যাকেজ:* ${packageName}` : ''}
⏱️ *মেয়াদ (Expiry):* *৫ মিনিট (5 Minutes)*

📌 *নির্দেশনা:*
১. অন্য ফোন বা ক্যামেরা দিয়ে স্ক্যান করুন, অথবা PUBG Mobile গেমের Scan অপশন ব্যবহার করুন।
২. স্ক্যান সম্পন্ন হলে নিচের *"✅ QR স্ক্যান করেছি"* বাটনে চাপ দিন।
৩. কোডের মেয়াদ শেষ হলে *"🔄 নতুন QR কোড দিন"* বাটনে চাপ দিন।`;

    // 1. Send the QR Code Image (automatically uploads buffer to Meta CDN for 100% delivery)
    const imageResult = await this.sendImage(cleanPhone, imageUrl, caption);
    if (!imageResult.success) {
      console.error(`[sendQrCodePrompt Image Error]: Failed to send image to ${cleanPhone}:`, imageResult.error);
    }

    // 2. Send interactive action buttons for quick customer response
    const buttons: WhatsAppButton[] = [
      { id: `qr_done:${orderId}`, title: '✅ QR স্ক্যান করেছি' },
      { id: `qr_refresh:${orderId}`, title: '🔄 নতুন QR কোড দিন' }
    ];

    const buttonBody = `👉 *স্ক্যান শেষ হলে বা নতুন QR লাগলে সিলেক্ট করুন:*`;
    await this.sendInteractiveButtons(cleanPhone, buttonBody, buttons, 'PUBG QR Login');

    return imageResult;
  },

  /**
   * Ask customer to check their email for a verification/security code and reply with it
   * (Used for PUBG KR / eFootball "code method" fulfillment — worker triggers this from Telegram)
   */
  async sendVerificationCodeRequest(
    toPhone: string,
    orderIdCode: string,
    isResend = false
  ): Promise<SendMessageResult> {
    const cleanPhone = toPhone.replace(/\D/g, '');

    const bodyText = isResend
      ? `⚠️ *কোডের মেয়াদ শেষ হয়ে গেছে!*\n\nআমাদের এডমিন আপনার গেম ইমেইলে *নতুন* একটি ভেরিফিকেশন কোড পাঠিয়েছেন। অনুগ্রহ করে আপনার গেম ইমেইল চেক করে নতুন কোডটি *এখানে টাইপ করে পাঠান*।\n\n📦 *অর্ডার আইডি:* \`#${orderIdCode}\``
      : `📧 *ভেরিফিকেশন কোড প্রয়োজন!*\n\nআমাদের এডমিন আপনার গেম ইমেইলে একটি ভেরিফিকেশন কোড পাঠিয়েছেন। অনুগ্রহ করে আপনার গেম ইমেইল চেক করে কোডটি *এখানে টাইপ করে পাঠান*।\n\n📦 *অর্ডার আইডি:* \`#${orderIdCode}\``;

    const buttons: WhatsAppButton[] = [
      { id: 'btn_main_menu', title: '🔙 মেইন মেনু' }
    ];

    return await this.sendInteractiveButtons(
      cleanPhone,
      bodyText,
      buttons,
      isResend ? 'নতুন কোড প্রয়োজন' : 'ভেরিফিকেশন কোড প্রয়োজন'
    );
  },

  /**
   * Send Netflix Account Credentials (Email, Password, PIN) to customer via WhatsApp
   */
  async sendNetflixAccountInfo(
    toPhone: string,
    orderIdCode: string,
    email: string,
    pass: string,
    pin?: string
  ): Promise<SendMessageResult> {
    const cleanPhone = toPhone.replace(/\D/g, '');
    const pinText = pin ? `\n📌 *প্রোফাইল পিন (PIN):* \`${pin}\`` : '';

    const bodyText = 
`🍿 *আপনার Netflix অ্যাকাউন্ট ও লগইন তথ্য:*

📧 *ইমেইল / Email:* \`${email}\`
🔑 *পাসওয়ার্ড / Password:* \`${pass}\`${pinText}
📦 *অর্ডার আইডি:* \`#${orderIdCode}\`

📲 *লগইন নির্দেশিকা:*
অনুগ্রহ করে আপনার ডিভাইসে/টিভিতে নেটফ্লিক্সে লগইন করুন। টিভিতে বা ব্রাউজারে ভেরিফিকেশন কোড বা হাউসহোল্ড কোড চাইলে নিচের *'📩 কোড প্রয়োজন'* বাটনে চাপ দিন।`;

    const buttons: WhatsAppButton[] = [
      { id: `netflix_need_code:${orderIdCode}`, title: '📩 কোড প্রয়োজন' },
      { id: `netflix_login_done:${orderIdCode}`, title: '✅ লগইন সম্পন্ন' }
    ];

    logBotMessageToConversation(cleanPhone, bodyText, {
      type: 'NETFLIX_CREDS_SENT',
      orderId: orderIdCode
    });

    return await this.sendInteractiveButtons(
      cleanPhone,
      bodyText,
      buttons,
      'Netflix অ্যাকাউন্ট'
    );
  },

  /**
   * Send Netflix Verification / Household Code to customer via WhatsApp
   */
  async sendNetflixVerificationCode(
    toPhone: string,
    orderIdCode: string,
    code: string
  ): Promise<SendMessageResult> {
    const cleanPhone = toPhone.replace(/\D/g, '');

    const bodyText = 
`🔑 *আপনার Netflix ভেরিফিকেশন কোড:*

👉 \`${code}\` 👈

📦 *অর্ডার আইডি:* \`#${orderIdCode}\`

অনুগ্রহ করে কোডটি দিয়ে লগইন সম্পন্ন করুন। সফলভাবে লগইন হলে নিচে *'✅ লগইন সম্পন্ন'* বাটনে চাপ দিন।`;

    const buttons: WhatsAppButton[] = [
      { id: `netflix_login_done:${orderIdCode}`, title: '✅ লগইন সম্পন্ন' },
      { id: `netflix_need_code:${orderIdCode}`, title: '🔄 নতুন কোড প্রয়োজন' }
    ];

    logBotMessageToConversation(cleanPhone, bodyText, {
      type: 'NETFLIX_CODE_SENT',
      orderId: orderIdCode,
      code
    });

    return await this.sendInteractiveButtons(
      cleanPhone,
      bodyText,
      buttons,
      'Netflix কোড'
    );
  },

  /**
   * Acknowledge customer request for Netflix code
   */
  async sendNetflixCodeRequestedAck(
    toPhone: string,
    orderIdCode: string
  ): Promise<SendMessageResult> {
    const cleanPhone = toPhone.replace(/\D/g, '');

    const bodyText = 
`⏳ *আমাদের টিমকে কোডের জন্য নোটিফাই করা হয়েছে!*

অর্ডার: \`#${orderIdCode}\`
আমাদের কর্মী আপনার Netflix ভেরিফিকেশন কোডটি চেক করে ১–৩ মিনিটের মধ্যে এই চ্যাটে পাঠিয়ে দিচ্ছেন। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন। 🍿⚡`;

    const buttons: WhatsAppButton[] = [
      { id: 'btn_main_menu', title: '🎮 মেইন মেনু' }
    ];

    return await this.sendInteractiveButtons(
      cleanPhone,
      bodyText,
      buttons,
      'কোডের অপেক্ষায়'
    );
  },

  /**
   * Send typing indicator and mark as read (shows "typing..." to customer in WhatsApp chat)
   */
  async markAsReadAndType(messageId: string): Promise<boolean> {
    if (!env.whatsapp.isConfigured || !messageId) {
      return false;
    }

    try {
      // First attempt: Cloud API typing indicator combined with read status
      const response = await fetch(`${env.whatsapp.apiUrl}/${env.whatsapp.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.whatsapp.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
          typing_indicator: {
            type: 'text'
          }
        }),
      });

      if (response.ok) {
        return true;
      }

      // Fallback to standard mark as read if typing indicator is not supported
      return await this.markAsRead(messageId);
    } catch (err) {
      console.warn('[WhatsApp markAsReadAndType Error]:', err);
      return await this.markAsRead(messageId);
    }
  },

  /**
   * Send an interactive CTA URL button (opens a webpage in browser directly from WhatsApp)
   */
  async sendInteractiveCtaUrl(
    toPhone: string,
    bodyText: string,
    buttonText: string,
    url: string,
    headerText?: string,
    footerText = 'DS Dukan — 24/7 Gaming Shop'
  ): Promise<SendMessageResult> {
    const cleanPhone = toPhone.replace(/\D/g, '');

    if (!env.whatsapp.isConfigured) {
      const errorMsg = 'WhatsApp Cloud API credentials not configured in environment';
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    try {
      const payload: Record<string, any> = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'interactive',
        interactive: {
          type: 'cta_url',
          body: { text: bodyText },
          footer: { text: footerText },
          action: {
            name: 'cta_url',
            parameters: {
              display_text: buttonText.slice(0, 20),
              url
            }
          }
        }
      };

      if (headerText) {
        payload.interactive.header = { type: 'text', text: headerText.slice(0, 60) };
      }

      console.log(`[WhatsApp sendInteractiveCtaUrl] Dispatching CTA URL button to ${cleanPhone}...`);

      const response = await fetch(`${env.whatsapp.apiUrl}/${env.whatsapp.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.whatsapp.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (response.ok && data.messages?.[0]?.id) {
        return { success: true, messageId: data.messages[0].id };
      }

      console.warn('[WhatsApp CTA URL API Error]: Falling back to standard message with link:', JSON.stringify(data));
      return await this.sendMessage(toPhone, `${bodyText}\n\n👉 *পেমেন্ট করতে এখানে চাপ দিন:*\n${url}`);
    } catch (err) {
      console.error('[WhatsApp CTA URL Exception]:', err);
      return await this.sendMessage(toPhone, `${bodyText}\n\n👉 *পেমেন্ট করতে এখানে চাপ দিন:*\n${url}`);
    }
  },

  /**
   * Send comprehensive Payment Request Prompt with ZiniPay link and Check Payment buttons
   */
  async sendPaymentInvoicePrompt(params: {
    toPhone: string;
    orderIdCode: string;
    paymentUrl: string;
    amount: number;
    gameLabel: string;
    packageName: string;
    playerUid: string;
    accountLabelBn?: string;
  }): Promise<SendMessageResult> {
    const { toPhone, orderIdCode, paymentUrl, amount, gameLabel, packageName, playerUid, accountLabelBn } = params;

    const messageText = 
`📝 *অর্ডার সামারি:*
• গেম / সার্ভিস: *${gameLabel}*
• প্যাকেজ: *${packageName}*
• 🆔 ${accountLabelBn || 'Player ID'}: \`${playerUid}\`
• প্রদেয় মূল্য: *৳${amount} Tk*

⚡ *পেমেন্ট সম্পন্ন করতে নিচের লিংকে ক্লিক করুন:*
${paymentUrl}

*(bKash, Nagad, Rocket বা Card দিয়ে ১ ক্লিকে নিরাপদ পেমেন্ট করুন। পেমেন্ট শেষ হওয়ামাত্রই আপনার অর্ডারটি স্বয়ংক্রিয়ভাবে ডেলিভারি হয়ে যাবে)*`;

    // 1. Send interactive CTA button message
    const ctaRes = await this.sendInteractiveCtaUrl(
      toPhone,
      messageText,
      '💳 Pay Now',
      paymentUrl,
      'DS Dukan Instant Checkout'
    );

    // 2. Also send Quick Action Buttons for "Check Payment" & "Cancel"
    const actionButtons = [
      { id: `check_pay:${orderIdCode}`, title: '🔄 পেমেন্ট চেক করুন' },
      { id: 'btn_main_menu', title: '❌ বাতিল করুন' }
    ];

    await this.sendInteractiveButtons(
      toPhone,
      `👉 *পেমেন্ট সম্পন্ন করার পর নিচের বাটন চাপুন অথবা মেসেজের জন্য অপেক্ষা করুন:*`,
      actionButtons,
      'Payment Verification'
    );

    return ctaRes;
  }
};



