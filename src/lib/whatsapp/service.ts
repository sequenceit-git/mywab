import { Order } from '@/types';
import { env } from '../config/env';
import { getAccountFieldInfo, formatPaymentDisplayForWhatsApp, getGameDeliveryConfig } from '../chat/input-parser';
import { baileysManager } from '../baileys';

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
   * Send a free-form text message to customer's WhatsApp via Baileys
   */
  async sendMessage(toPhone: string, text: string): Promise<SendMessageResult> {
    const cleanPhone = toPhone.replace(/\D/g, '');

    if (!baileysManager.isConnected) {
      console.warn(`[WhatsAppService] Socket not connected. Message to ${cleanPhone} queued/failed.`);
      return {
        success: false,
        error: 'WhatsApp Web (Baileys) is not connected. Please scan QR or enter pairing code in Admin Settings (/config).'
      };
    }

    return await baileysManager.sendMessage(cleanPhone, text);
  },

  /**
   * Send an interactive Quick Reply Buttons message (nativeFlowMessage) via Baileys
   */
  async sendInteractiveButtons(
    toPhone: string,
    bodyText: string,
    buttons: WhatsAppButton[],
    headerText?: string,
    footerText = 'DS Dukan — 24/7 Gaming Shop'
  ): Promise<SendMessageResult> {
    const cleanPhone = toPhone.replace(/\D/g, '');

    if (!baileysManager.isConnected) {
      return await this.sendMessage(toPhone, bodyText);
    }

    return await baileysManager.sendInteractiveButtons(
      cleanPhone,
      bodyText,
      buttons.map(b => ({ id: b.id, title: b.title })),
      headerText,
      footerText
    );
  },

  /**
   * Send an interactive single-select List message via Baileys
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

    if (!baileysManager.isConnected) {
      return await this.sendMessage(toPhone, bodyText);
    }

    return await baileysManager.sendInteractiveList(
      cleanPhone,
      bodyText,
      buttonLabel,
      sections.map(s => ({
        title: s.title,
        rows: s.rows.map(r => ({ id: r.id, title: r.title, description: r.description }))
      })),
      headerText,
      footerText
    );
  },

  /**
   * Send an interactive CTA URL button (opens webpage directly) via Baileys
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

    if (!baileysManager.isConnected) {
      return await this.sendMessage(toPhone, `${bodyText}\n\n👉 *পেমেন্ট করতে এখানে চাপ দিন:*\n${url}`);
    }

    return await baileysManager.sendInteractiveCtaUrl(
      cleanPhone,
      bodyText,
      buttonText,
      url,
      headerText,
      footerText
    );
  },

  /**
   * Send an image or photo message (e.g. login QR code screenshot) via Baileys
   */
  async sendImage(
    toPhone: string,
    imageSource: string | ArrayBuffer | Buffer,
    caption?: string
  ): Promise<SendMessageResult> {
    const cleanPhone = toPhone.replace(/\D/g, '');

    if (!baileysManager.isConnected) {
      return {
        success: false,
        error: 'WhatsApp Web (Baileys) is not connected. Please connect via Admin Settings.'
      };
    }

    const bufferOrUrl = Buffer.isBuffer(imageSource)
      ? imageSource
      : (imageSource instanceof ArrayBuffer ? Buffer.from(imageSource) : imageSource);

    return await baileysManager.sendImage(cleanPhone, bufferOrUrl, caption);
  },

  /**
   * Mark incoming message as seen
   */
  async markAsRead(messageId: string): Promise<boolean> {
    return true;
  },

  /**
   * Send typing indicator
   */
  async markAsReadAndType(messageId: string): Promise<boolean> {
    return true;
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

    let completionNote = `আপনার আইডিতে টপ-আপ যুক্ত করা হয়েছে।`;
    if (accountInfo.isEmail) {
      completionNote = `আপনার সাবস্ক্রিপশন চালু করে অ্যাকাউন্ট/লগইন তথ্য সফলভাবে সরবরাহ করা হয়েছে।`;
    }

    const messageText = 
`✅ *অর্ডার সফলভাবে সম্পন্ন হয়েছে / Order Delivered!*

প্রিয় গ্রাহক, আপনার অর্ডার *#${order.order_id}* (${playerUid}) সফলভাবে সম্পন্ন হয়েছে এবং ${completionNote} ✨

DS Dukan থেকে কেনাকাটা করার জন্য ধন্যবাদ! ❤️
ওয়েবসাইটে ২% ডিসকাউন্টে সরাসরি কিনতে ভিজিট করুন: https://www.dsdukan.com/#

🎮 *অন্য কোনো গেম বা সাবস্ক্রিপশন নিতে নিচের মেনু বাটনে চাপ দিন:*`;

    const buttons: WhatsAppButton[] = [
      { id: 'btn_main_menu', title: '🎮 সব সার্ভিস ও গেম' },
      { id: `track:${order.order_id}`, title: '📦 অর্ডার সামারি' },
      { id: 'btn_website', title: '🌐 ওয়েবসাইট' }
    ];

    return this.sendInteractiveButtons(order.delivery_phone, messageText, buttons, 'DS Dukan Success');
  },

  /**
   * Send Order Cancelled notification to customer
   */
  async sendOrderCancelledNotification(order: Order, reason?: string): Promise<SendMessageResult> {
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

    return this.sendInteractiveButtons(order.delivery_phone, messageText, buttons, 'DS Dukan Support');
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

    // 1. Send the QR Code Image
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
