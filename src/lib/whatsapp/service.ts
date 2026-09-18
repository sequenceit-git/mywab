import { Order } from '@/types';
import { env } from '@/lib/config/env';
import { getAccountFieldInfo, formatPaymentDisplayForWhatsApp, getGameDeliveryConfig } from '@/lib/chat/input-parser';

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
    footerText = 'WapBusiness Shopping Assistant'
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

${deliveryConfig.deliveryMessage}`;

    const buttons: WhatsAppButton[] = [
      { id: `track:${order.order_id}`, title: '📦 অর্ডার ট্র্যাক' },
      { id: 'btn_game_list', title: deliveryConfig.catalogButtonTitle },
      { id: 'btn_website', title: '🌐 ওয়েবসাইট ২% ছাড়' }
    ];

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
      { id: `track:${order.order_id}`, title: '📦 লাইভ স্ট্যাটাস' }
    ];

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
    const deliveryConfig = getGameDeliveryConfig(gameTitle, firstItem?.product_name);

    let completionNote = `আপনার আইডিতে টপ-আপ যুক্ত করা হয়েছে।`;
    if (accountInfo.isEmail) {
      completionNote = `আপনার সাবস্ক্রিপশন চালু করে অ্যাকাউন্ট/লগইন তথ্য সফলভাবে সরবরাহ করা হয়েছে।`;
    }

    const messageText = 
`✅ *অর্ডার সফলভাবে সম্পন্ন হয়েছে / Order Delivered!*

প্রিয় গ্রাহক, আপনার অর্ডার *#${order.order_id}* (${playerUid}) সফলভাবে সম্পন্ন হয়েছে এবং ${completionNote} ✨

DS Dukan থেকে কেনাকাটা করার জন্য ধন্যবাদ! ❤️
ওয়েবসাইটে ২% ডিসকাউন্টে সরাসরি কিনতে ভিজিট করুন: https://www.dsdukan.com/#`;

    const buttons: WhatsAppButton[] = [
      { id: 'btn_game_list', title: deliveryConfig.catalogButtonTitle },
      { id: 'btn_website', title: '🌐 ওয়েবসাইট' }
    ];

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
    const deliveryConfig = getGameDeliveryConfig(gameTitle, firstItem?.product_name);

    const messageText = 
`❌ *অর্ডার বাতিল করা হয়েছে / Order Cancelled*

প্রিয় গ্রাহক, আপনার অর্ডার *#${order.order_id}* (${playerUid}) বাতিল করা হয়েছে।
${reason ? `\n📌 *কারণ / Reason:* ${reason}` : ''}
💰 *মোট মূল্য:* ৳${order.total_amount}

কোনো জিজ্ঞাসা বা সহায়তার জন্য আমাদের ইনবক্সে মেসেজ দিন অথবা ভিজিট করুন: https://www.dsdukan.com/#`;

    const buttons: WhatsAppButton[] = [
      { id: 'btn_game_list', title: deliveryConfig.catalogButtonTitle },
      { id: 'btn_website', title: '🌐 ওয়েবসাইট ২% ছাড়' }
    ];

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
  }
};

