import { Order } from '@/types';
import { db } from '@/lib/db';
import { whatsappService } from '@/lib/whatsapp/service';
import { env } from '@/lib/config/env';

export const telegramBot = {
  /**
   * Helper to build HTML card and inline keyboard for any order state
   */
  generateOrderCard(order: Order, assignedWorkerName?: string): { cardHtml: string; replyMarkup: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } } {
    const itemsText = order.items
      ?.map(item => `  ▪️ <b>${item.product_name}</b> x ${item.quantity} = ৳${item.subtotal}`)
      .join('\n') || '  ▪️ No item details';

    const workerName = assignedWorkerName || order.current_worker?.full_name || 'Worker Assigned';
    const playerUid = order.player_uid || order.delivery_address?.name || 'N/A';
    const trxId = order.trx_id || 'N/A';
    const paymentMethod = order.payment_method || 'bKash/Nagad/Rocket';

    if (order.status === 'CLAIMED' || order.status === 'PROCESSING') {
      return {
        cardHtml: 
`✅ <b>TOP-UP CLAIMED / টপ-আপ গ্রহণ করা হয়েছে</b>

📦 <b>Order ID:</b> <code>${order.order_id}</code>
👷 <b>Assigned Worker:</b> <b>${workerName}</b>
🎮 <b>Player UID:</b> <code>${playerUid}</code>
💳 <b>Payment:</b> ${paymentMethod} (TrxID: <code>${trxId}</code>)
💰 <b>Total Amount:</b> ৳${order.total_amount}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>
📝 <b>Notes:</b> ${order.customer_notes || 'None'}

💎 <b>Packages:</b>
${itemsText}

<i>Worker: Process the top-up in PUBG and click below when complete:</i>`,
        replyMarkup: {
          inline_keyboard: [
            [
              { text: '✅ Top-Up Completed (ডেলিভারি সম্পন্ন)', callback_data: `status_delivered:${order.order_id}` }
            ]
          ]
        }
      };
    }

    if (order.status === 'OUT_FOR_DELIVERY') {
      return {
        cardHtml: 
`⚡ <b>PROCESSING TOP-UP / প্রসেসিং চলছে</b>

📦 <b>Order ID:</b> <code>${order.order_id}</code>
👷 <b>Assigned Worker:</b> <b>${workerName}</b>
🎮 <b>Player UID:</b> <code>${playerUid}</code>
💰 <b>Total Amount:</b> ৳${order.total_amount}
💳 <b>TrxID:</b> <code>${trxId}</code>
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>

<i>Click below once top-up is completed:</i>`,
        replyMarkup: {
          inline_keyboard: [
            [
              { text: '✅ Top-Up Completed', callback_data: `status_delivered:${order.order_id}` }
            ]
          ]
        }
      };
    }

    if (order.status === 'DELIVERED') {
      return {
        cardHtml: 
`🎉 <b>TOP-UP COMPLETED & DELIVERED / সম্পন্ন হয়েছে</b>

📦 <b>Order ID:</b> <code>${order.order_id}</code>
🎮 <b>Player UID:</b> <code>${playerUid}</code>
👷 <b>Processed by:</b> <b>${workerName}</b>
💰 <b>Amount:</b> ৳${order.total_amount}
💳 <b>TrxID:</b> <code>${trxId}</code>
🕒 <b>Completed at:</b> ${new Date().toLocaleTimeString()}`,
        replyMarkup: {
          inline_keyboard: []
        }
      };
    }

    if (order.status === 'CANCELLED') {
      return {
        cardHtml: 
`❌ <b>TOP-UP CANCELLED / অর্ডার বাতিল করা হয়েছে</b>

📦 <b>Order ID:</b> <code>${order.order_id}</code>
🎮 <b>Player UID:</b> <code>${playerUid}</code>
💰 <b>Total Amount:</b> ৳${order.total_amount}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>

<i>This order has been cancelled from the system.</i>`,
        replyMarkup: {
          inline_keyboard: []
        }
      };
    }

    // Default: PENDING_CLAIM / PENDING_PAYMENT
    return {
      cardHtml: 
`🚨 <b>NEW TOP-UP ORDER / নতুন টপ-আপ অর্ডার</b>

📦 <b>Order ID:</b> <code>${order.order_id}</code>
🎮 <b>Player UID:</b> <code>${playerUid}</code>
💰 <b>Total Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> ${paymentMethod}
🔢 <b>TrxID / Sender:</b> <code>${trxId}</code>
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>
📝 <b>Notes:</b> ${order.customer_notes || 'None'}

💎 <b>Packages:</b>
${itemsText}

<i>Click below to claim and process this top-up order:</i>`,
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: '⚡ Claim Top-Up (অর্ডার গ্রহণ করুন)',
              callback_data: `claim:${order.order_id}`
            }
          ]
        ]
      }
    };
  },

  /**
   * Send new order card to the Telegram Worker Group with Claim button
   */
  async dispatchNewOrder(order: Order): Promise<{ success: boolean; messageId?: number; error?: string }> {
    if (!env.telegram.isConfigured) {
      const errorMsg = 'Telegram Worker Bot not configured in environment';
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    const { cardHtml, replyMarkup } = this.generateOrderCard(order);

    try {
      const response = await fetch(`${env.telegram.apiUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.telegram.workerGroupId,
          text: cardHtml,
          parse_mode: 'HTML',
          reply_markup: replyMarkup
        })
      });

      const data = await response.json();
      if (data.ok && data.result?.message_id) {
        order.telegram_message_id = data.result.message_id;
        await db.updateOrderTelegramMessageId(order.id, data.result.message_id);
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
   * Synchronize Telegram message state when order is modified from the website
   * Removes previous message (if any) and sends the new state card, updating telegram_message_id
   */
  async syncOrderStatus(
    order: Order,
    options: { deletePrevious?: boolean; workerName?: string } = { deletePrevious: true }
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    if (!env.telegram.isConfigured) {
      return { success: false, error: 'Telegram bot not configured' };
    }

    const { cardHtml, replyMarkup } = this.generateOrderCard(order, options.workerName);
    const prevMsgId = order.telegram_message_id;

    console.log(`[Telegram Sync] Syncing Order #${order.order_id} -> Status: ${order.status} | Prev Msg ID: ${prevMsgId}`);

    // If we want to delete previous message and post new state
    if (options.deletePrevious && prevMsgId) {
      const deleted = await this.deleteMessage(env.telegram.workerGroupId, prevMsgId);
      console.log(`[Telegram Sync] Deleted previous message ${prevMsgId}: ${deleted}`);
    }

    // Send the new status card
    try {
      const response = await fetch(`${env.telegram.apiUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.telegram.workerGroupId,
          text: cardHtml,
          parse_mode: 'HTML',
          reply_markup: replyMarkup
        })
      });

      const data = await response.json();
      if (data.ok && data.result?.message_id) {
        const newMsgId = data.result.message_id;
        order.telegram_message_id = newMsgId;
        await db.updateOrderTelegramMessageId(order.id, newMsgId);
        return { success: true, messageId: newMsgId };
      }

      // Fallback: If sendMessage failed after delete attempt or if delete was skipped, try editMessageText on prevMsgId
      if (prevMsgId) {
        console.warn(`[Telegram Sync] Falling back to editMessageText for msg ${prevMsgId}`);
        await this.editMessageText(env.telegram.workerGroupId, prevMsgId, cardHtml, replyMarkup);
        return { success: true, messageId: prevMsgId };
      }

      return { success: false, error: data.description || 'Failed to sync to Telegram' };
    } catch (err) {
      console.error('[Telegram Sync Network Error]:', err);
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
          const { cardHtml, replyMarkup } = this.generateOrderCard(order, workerName);
          await this.editMessageText(message.chat.id, message.message_id, cardHtml, replyMarkup);
        }

        // Notify customer on WhatsApp (non-blocking)
        if (order) {
          whatsappService.sendOrderClaimedNotification(order, workerName).catch(err => {
            console.error('[Telegram->WhatsApp Notify Error on Claim]:', err);
          });
        }

        await this.answerCallbackQuery(id, `✅ You have successfully claimed top-up #${orderIdCode}!`, false);
        return { success: true, message: `Claimed by ${workerName}` };
      } catch (claimErr) {
        console.error('[Telegram Claim Error]:', claimErr);
        await this.answerCallbackQuery(id, `⚠️ Error claiming order: ${String(claimErr)}`, true);
        return { success: false, message: String(claimErr) };
      }
    }

    // 2. ACTION: OUT FOR DELIVERY / PROCESSING
    if (action === 'status_out') {
      try {
        const updateResult = await db.updateOrderStatus(orderIdCode, 'OUT_FOR_DELIVERY', from.id);
        const order = updateResult.order;
        
        if (message && order) {
          const { cardHtml, replyMarkup } = this.generateOrderCard(order, workerName);
          await this.editMessageText(message.chat.id, message.message_id, cardHtml, replyMarkup);
        }

        await this.answerCallbackQuery(id, `⚡ Top-up #${orderIdCode} is being processed!`, false);
        return { success: true, message: 'Status updated to OUT_FOR_DELIVERY' };
      } catch (err) {
        console.error('[Telegram Status Out Error]:', err);
        await this.answerCallbackQuery(id, `⚠️ Failed to update: ${String(err)}`, true);
        return { success: false, message: String(err) };
      }
    }

    // 3. ACTION: MARK DELIVERED / COMPLETED
    if (action === 'status_delivered') {
      try {
        const updateResult = await db.updateOrderStatus(orderIdCode, 'DELIVERED', from.id);
        const order = updateResult.order;

        if (order && message) {
          const { cardHtml, replyMarkup } = this.generateOrderCard(order, workerName);
          await this.editMessageText(message.chat.id, message.message_id, cardHtml, replyMarkup);

          // Trigger automated WhatsApp delivery confirmation to customer (non-blocking)
          whatsappService.sendOrderDeliveredNotification(order).catch(err => {
            console.error('[Telegram->WhatsApp Notify Error on Delivered]:', err);
          });
        }

        await this.answerCallbackQuery(id, `🎉 Top-up #${orderIdCode} marked as Delivered!`, false);
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

  async deleteMessage(chatId: string | number, messageId: number): Promise<boolean> {
    if (!env.telegram.isConfigured) return false;
    try {
      const response = await fetch(`${env.telegram.apiUrl}/deleteMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId
        })
      });
      const data = await response.json();
      return Boolean(data.ok);
    } catch (e) {
      console.error('Error deleting telegram message:', e);
      return false;
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
