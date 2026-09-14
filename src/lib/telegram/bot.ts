import { Order } from '@/types';
import { db } from '@/lib/db';
import { whatsappService } from '@/lib/whatsapp/service';
import { env } from '@/lib/config/env';

export const telegramBot = {
  /**
   * Send new order card to the Telegram Worker Group with Claim button
   */
  async dispatchNewOrder(order: Order): Promise<{ success: boolean; messageId?: number; error?: string }> {
    const itemsText = order.items
      ?.map(item => `  ▪️ <b>${item.product_name}</b> x ${item.quantity} = ৳${item.subtotal}`)
      .join('\n') || '  ▪️ No item details';

    const cardHtml = 
`🚨 <b>NEW ORDER AVAILABLE FOR CLAIM / নতুন অর্ডার</b>

📦 <b>Order ID:</b> <code>${order.order_id}</code>
💰 <b>Total Amount:</b> ৳${order.total_amount}
👤 <b>Customer:</b> ${order.customer?.name || order.delivery_address.name || 'Anonymous'}
📞 <b>Phone:</b> <code>${order.delivery_phone}</code>
📍 <b>Delivery Address:</b> ${order.delivery_address.address}
📝 <b>Notes:</b> ${order.customer_notes || 'None'}

🛍 <b>Items:</b>
${itemsText}

<i>Click below to claim and assign this order to yourself.</i>`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          {
            text: '⚡ Claim Order (গ্রহণ করুন)',
            callback_data: `claim:${order.order_id}`
          }
        ]
      ]
    };

    if (!env.telegram.isConfigured) {
      const errorMsg = 'Telegram Worker Bot not configured in environment';
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    try {
      const response = await fetch(`${env.telegram.apiUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.telegram.workerGroupId,
          text: cardHtml,
          parse_mode: 'HTML',
          reply_markup: inlineKeyboard
        })
      });

      const data = await response.json();
      if (data.ok && data.result?.message_id) {
        order.telegram_message_id = data.result.message_id;
        return { success: true, messageId: data.result.message_id };
      }
      console.error('Telegram API Dispatch Error:', data);
      return { success: false, error: data.description || 'Failed to dispatch to Telegram' };
    } catch (err) {
      console.error('Telegram API Network Error:', err);
      return { success: false, error: String(err) };
    }
  },

  /**
   * Handle interactive callback queries from Telegram inline buttons
   */
  async handleCallbackQuery(callbackQuery: {
    id: string;
    from: { id: number; first_name: string; last_name?: string; username?: string };
    message?: { message_id: number; chat: { id: number | string } };
    data?: string;
  }): Promise<{ success: boolean; message: string; alertText?: string }> {
    const { id, from, message, data } = callbackQuery;
    if (!data) {
      await this.answerCallbackQuery(id, '⚠️ Invalid action', true);
      return { success: false, message: 'No callback data' };
    }

    const colonIndex = data.indexOf(':');
    const action = colonIndex !== -1 ? data.slice(0, colonIndex) : data;
    const orderIdCode = (colonIndex !== -1 ? data.slice(colonIndex + 1) : '').trim();
    const workerName = [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || `Worker-${from.id}`;

    console.log(`[Telegram Callback] Action: "${action}" | OrderCode: "${orderIdCode}" | Worker: "${workerName}" (ID: ${from.id})`);

    // 1. ACTION: CLAIM ORDER
    if (action === 'claim') {
      try {
        const claimResult = await db.claimOrderAtomic({
          orderIdCode,
          telegramUserId: from.id,
          workerName,
          telegramUsername: from.username
        });

        if (!claimResult.success) {
          await this.answerCallbackQuery(id, `⚠️ ${claimResult.message}`, true);
          return { success: false, message: claimResult.message, alertText: claimResult.message };
        }

        const order = claimResult.order;
        
        // Update Telegram Card UI in Group to show claimed status and operational buttons
        if (message && order) {
          const updatedText = 
`✅ <b>ORDER CLAIMED / অর্ডার গ্রহণ করা হয়েছে</b>

📦 <b>Order ID:</b> <code>${order.order_id}</code>
👷 <b>Claimed by:</b> <b>${workerName}</b> (@${from.username || 'NoUsername'})
💰 <b>Total Amount:</b> ৳${order.total_amount}
📍 <b>Delivery Address:</b> ${order.delivery_address?.address || 'N/A'}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>

<i>Worker actions:</i>`;

          const claimedKeyboard = {
            inline_keyboard: [
              [
                { text: '🚚 Out for Delivery', callback_data: `status_out:${order.order_id}` },
                { text: '✅ Mark Delivered', callback_data: `status_delivered:${order.order_id}` }
              ]
            ]
          };

          await this.editMessageText(message.chat.id, message.message_id, updatedText, claimedKeyboard);
        }

        // Notify customer on WhatsApp (non-blocking)
        if (order) {
          whatsappService.sendOrderClaimedNotification(order, workerName).catch(err => {
            console.error('[Telegram->WhatsApp Notify Error on Claim]:', err);
          });
        }

        await this.answerCallbackQuery(id, `✅ You have successfully claimed order #${orderIdCode}!`, false);
        return { success: true, message: `Claimed by ${workerName}` };
      } catch (claimErr) {
        console.error('[Telegram Claim Error]:', claimErr);
        await this.answerCallbackQuery(id, `⚠️ Error claiming order: ${String(claimErr)}`, true);
        return { success: false, message: String(claimErr) };
      }
    }

    // 2. ACTION: OUT FOR DELIVERY
    if (action === 'status_out') {
      try {
        await db.updateOrderStatus(orderIdCode, 'OUT_FOR_DELIVERY', from.id);
        
        if (message) {
          const outKeyboard = {
            inline_keyboard: [
              [
                { text: '✅ Mark Delivered', callback_data: `status_delivered:${orderIdCode}` }
              ]
            ]
          };
          await this.editMessageText(
            message.chat.id,
            message.message_id,
            `🚚 <b>OUT FOR DELIVERY / ডেলিভারি চলছে</b>\n\n📦 <b>Order ID:</b> <code>${orderIdCode}</code>\n👷 <b>Assigned Worker:</b> <b>${workerName}</b>\n\n<i>Click below once delivered:</i>`,
            outKeyboard
          );
        }

        await this.answerCallbackQuery(id, `🚚 Order #${orderIdCode} is now out for delivery!`, false);
        return { success: true, message: 'Status updated to OUT_FOR_DELIVERY' };
      } catch (err) {
        console.error('[Telegram Status Out Error]:', err);
        await this.answerCallbackQuery(id, `⚠️ Failed to update: ${String(err)}`, true);
        return { success: false, message: String(err) };
      }
    }

    // 3. ACTION: MARK DELIVERED
    if (action === 'status_delivered') {
      try {
        const updateResult = await db.updateOrderStatus(orderIdCode, 'DELIVERED', from.id);
        const order = updateResult.order;

        if (order && message) {
          const completedText = 
`🎉 <b>ORDER COMPLETED & DELIVERED</b>

📦 <b>Order ID:</b> <code>${order.order_id}</code>
👷 <b>Delivered by:</b> <b>${workerName}</b>
💰 <b>Collected Amount:</b> ৳${order.total_amount}
📍 <b>Delivered to:</b> ${order.delivery_address?.address || 'N/A'}
🕒 <b>Delivered at:</b> ${new Date().toLocaleTimeString()}`;

          await this.editMessageText(message.chat.id, message.message_id, completedText, { inline_keyboard: [] });

          // Trigger automated WhatsApp delivery confirmation to customer (non-blocking)
          whatsappService.sendOrderDeliveredNotification(order).catch(err => {
            console.error('[Telegram->WhatsApp Notify Error on Delivered]:', err);
          });
        }

        await this.answerCallbackQuery(id, `🎉 Order #${orderIdCode} marked as Delivered!`, false);
        return { success: true, message: 'Delivered successfully' };
      } catch (err) {
        console.error('[Telegram Delivered Error]:', err);
        await this.answerCallbackQuery(id, `⚠️ Failed to mark delivered: ${String(err)}`, true);
        return { success: false, message: String(err) };
      }
    }

    await this.answerCallbackQuery(id, 'Unknown action', false);
    return { success: false, message: 'Unknown action' };
  },

  async answerCallbackQuery(callbackQueryId: string, text: string, showAlert = false) {
    if (!env.telegram.isConfigured) return;
    try {
      await fetch(`${env.telegram.apiUrl}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text,
          show_alert: showAlert
        })
      });
    } catch (e) {
      console.error('Error answering callback query:', e);
    }
  },

  async editMessageText(chatId: string | number, messageId: number, text: string, replyMarkup?: unknown) {
    if (!env.telegram.isConfigured) return;
    try {
      await fetch(`${env.telegram.apiUrl}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: 'HTML',
          reply_markup: replyMarkup
        })
      });
    } catch (e) {
      console.error('Error editing message text:', e);
    }
  }
};
