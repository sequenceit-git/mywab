import { Order } from '@/types';
import { env } from '@/lib/config/env';

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface WhatsAppButton {
  id: string;
  title: string;
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
   * Send structured Order Confirmation notification to customer with buttons
   */
  async sendOrderConfirmation(order: Order): Promise<SendMessageResult> {
    const itemsList = order.items?.map(i => `• ${i.product_name} x ${i.quantity} = ৳${i.subtotal}`).join('\n') || '';
    const playerUid = order.player_uid || order.delivery_address?.name || 'N/A';
    
    const messageText = 
`🎉 *টপ-আপ অর্ডার নিশ্চিতকরণ / Top-Up Confirmed!*

প্রিয় গ্রাহক, আপনার টপ-আপ অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে।

📦 *Order ID:* \`${order.order_id}\`
🎮 *Player UID:* \`${playerUid}\`
💰 *মোট মূল্য (Total):* ৳${order.total_amount}
💳 *পেমেন্ট:* ${order.payment_method || 'bKash/Nagad/Rocket'} (TrxID: \`${order.trx_id || 'N/A'}\`)
⚡ *ডেলিভারি সময়:* ৫–১৫ মিনিট (5-15 Minutes)

*প্যাকেজসমূহ (Packages):*
${itemsList}

আমাদের টপ-আপ টিম খুব দ্রুত আপনার আইডিতে ইউসি পাঠিয়ে দেবে! 🚀`;

    const buttons: WhatsAppButton[] = [
      { id: `track:${order.order_id}`, title: '📦 অর্ডার ট্র্যাক' },
      { id: 'btn_catalog', title: '💎 UC প্রাইস লিস্ট' },
      { id: 'btn_website', title: '🌐 ওয়েবসাইট ২% ছাড়' }
    ];

    return this.sendInteractiveButtons(order.delivery_phone, messageText, buttons, 'DS Dukan Top-Up');
  },

  /**
   * Send Order Claimed by Worker notification
   */
  async sendOrderClaimedNotification(order: Order, workerName: string): Promise<SendMessageResult> {
    const messageText = 
`⚡ *টপ-আপ আপডেট / Processing Top-Up!*

আপনার টপ-আপ অর্ডার *#${order.order_id}* প্রসেসিং শুরু হয়েছে।
আমাদের কর্মী *${workerName}* আপনার আইডিতে ইউসি টপ-আপ করছেন (সময় ৫–১৫ মিনিট)।`;

    const buttons: WhatsAppButton[] = [
      { id: `track:${order.order_id}`, title: '📦 লাইভ স্ট্যাটাস' }
    ];

    return this.sendInteractiveButtons(order.delivery_phone, messageText, buttons, 'DS Dukan Update');
  },

  /**
   * Send Order Delivered & Completed notification
   */
  async sendOrderDeliveredNotification(order: Order): Promise<SendMessageResult> {
    const messageText = 
`✅ *টপ-আপ সফলভাবে সম্পন্ন হয়েছে / Top-Up Delivered!*

প্রিয় গ্রাহক, আপনার অর্ডার *#${order.order_id}* সফলভাবে সম্পন্ন হয়েছে এবং ইউসি আপনার PUBG আইডিতে যুক্ত করা হয়েছে। 🎮✨

DS Dukan থেকে কেনাকাটা করার জন্য ধন্যবাদ! ❤️
ওয়েবসাইটে ২% ডিসকাউন্টে সরাসরি কিনতে ভিজিট করুন: https://www.dsdukan.com/#`;

    const buttons: WhatsAppButton[] = [
      { id: 'btn_catalog', title: '💎 UC প্রাইস লিস্ট' },
      { id: 'btn_website', title: '🌐 ওয়েবসাইট' }
    ];

    return this.sendInteractiveButtons(order.delivery_phone, messageText, buttons, 'DS Dukan Success');
  }
};
