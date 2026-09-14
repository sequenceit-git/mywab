import { Order } from '@/types';
import { env } from '@/lib/config/env';

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  simulated?: boolean;
  error?: string;
}

export interface WhatsAppButton {
  id: string;
  title: string;
}

export const whatsappService = {
  /**
   * Send a free-form text message to customer's WhatsApp
   */
  async sendMessage(toPhone: string, text: string): Promise<SendMessageResult> {
    const cleanPhone = toPhone.replace(/\D/g, '');

    // If WhatsApp Cloud API credentials are configured in .env, send via Meta Graph API
    if (env.whatsapp.isConfigured) {
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
          return { success: true, messageId: data.messages[0].id, simulated: false };
        }
        console.error('WhatsApp API Error:', data);
        return { success: false, error: JSON.stringify(data), simulated: false };
      } catch (err) {
        console.error('WhatsApp API Network Exception:', err);
        return { success: false, error: String(err) };
      }
    }

    // Otherwise log in simulated mode for instant sandbox testing
    console.log(`[WhatsApp Simulated -> ${toPhone}]:\n${text}`);
    return {
      success: true,
      messageId: `sim-wa-${Date.now()}`,
      simulated: true
    };
  },

  /**
   * Send an interactive Quick Reply Buttons message (up to 3 buttons)
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

    if (env.whatsapp.isConfigured && validButtons.length > 0) {
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
          return { success: true, messageId: data.messages[0].id, simulated: false };
        }
        console.error('WhatsApp Interactive Button API Error:', data);
      } catch (err) {
        console.error('WhatsApp Interactive Button Network Exception:', err);
      }
    }

    console.log(`[WhatsApp Simulated Buttons -> ${toPhone}]:\nBody: ${bodyText}\nButtons: ${validButtons.map(b => `[${b.reply.title}]`).join(' ')}`);
    return {
      success: true,
      messageId: `sim-wa-btn-${Date.now()}`,
      simulated: true
    };
  },

  /**
   * Send structured Order Confirmation notification to customer with buttons
   */
  async sendOrderConfirmation(order: Order): Promise<SendMessageResult> {
    const itemsList = order.items?.map(i => `• ${i.product_name} x ${i.quantity} = ৳${i.subtotal}`).join('\n') || '';
    
    const messageText = 
`🎉 *অর্ডার নিশ্চিতকরণ / Order Confirmed!*

প্রিয় গ্রাহক, আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে।

📦 *Order ID:* \`${order.order_id}\`
💰 *মোট মূল্য (Total):* ৳${order.total_amount}
📍 *ডেলিভারি ঠিকানা:* ${order.delivery_address.address}
📞 *ফোন নম্বর:* ${order.delivery_phone}

*অর্ডারকৃত পণ্যসমূহ (Items):*
${itemsList}

আমাদের ডেলিভারি টিম খুব দ্রুত আপনার সাথে যোগাযোগ করবে!`;

    const buttons: WhatsAppButton[] = [
      { id: `track:${order.order_id}`, title: '📦 অর্ডার ট্র্যাক' },
      { id: 'btn_catalog', title: '🛍️ আরও পণ্য দেখুন' },
      { id: 'btn_support', title: '👤 সহায়তা' }
    ];

    return this.sendInteractiveButtons(order.delivery_phone, messageText, buttons, 'WapBusiness Confirmation');
  },

  /**
   * Send Order Claimed by Worker notification
   */
  async sendOrderClaimedNotification(order: Order, workerName: string): Promise<SendMessageResult> {
    const messageText = 
`🚚 *অর্ডার আপডেট / Order Update!*

আপনার অর্ডার *#${order.order_id}* প্রস্তুত করার কাজ শুরু হয়েছে।
আমাদের ডেলিভারি প্রতিনিধি *${workerName}* অর্ডারটি প্রসেস করছেন।`;

    const buttons: WhatsAppButton[] = [
      { id: `track:${order.order_id}`, title: '📦 লাইভ স্ট্যাটাস' }
    ];

    return this.sendInteractiveButtons(order.delivery_phone, messageText, buttons);
  },

  /**
   * Send Order Delivered & Completed notification
   */
  async sendOrderDeliveredNotification(order: Order): Promise<SendMessageResult> {
    const messageText = 
`✅ *অর্ডার ডেলিভারি সম্পন্ন / Order Delivered!*

প্রিয় গ্রাহক, আপনার অর্ডার *#${order.order_id}* সফলভাবে ডেলিভারি সম্পন্ন হয়েছে।
আমাদের সাথে কেনাকাটা করার জন্য ধন্যবাদ! ❤️`;

    const buttons: WhatsAppButton[] = [
      { id: 'btn_catalog', title: '🛍️ নতুন কালেকশন' },
      { id: 'btn_feedback', title: '⭐ রিভিউ দিন' }
    ];

    return this.sendInteractiveButtons(order.delivery_phone, messageText, buttons);
  }
};
