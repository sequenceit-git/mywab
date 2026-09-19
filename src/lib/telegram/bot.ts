import { Order } from '@/types';
import { db } from '../db';
import { whatsappService } from '../whatsapp/service';
import { env } from '../config/env';
import { getAccountFieldInfo, formatPaymentDisplayForTelegram } from '../chat/input-parser';

export interface PendingWorkerCancellation {
  orderIdCode: string;
  workerTelegramId: number;
  workerName: string;
  chatId?: string | number;
  messageId?: number;
  createdAt: number;
}

// In-memory store for tracking active worker cancellation prompt sessions
const pendingWorkerCancellations = new Map<number, PendingWorkerCancellation>();

export const telegramBot = {
  /**
   * Pending cancellation session helpers
   */
  setPendingCancellation(workerTelegramId: number, data: Omit<PendingWorkerCancellation, 'createdAt'>) {
    pendingWorkerCancellations.set(workerTelegramId, { ...data, createdAt: Date.now() });
  },

  getPendingCancellation(workerTelegramId: number): PendingWorkerCancellation | undefined {
    const pending = pendingWorkerCancellations.get(workerTelegramId);
    if (!pending) return undefined;
    // Expire after 15 minutes
    if (Date.now() - pending.createdAt > 15 * 60 * 1000) {
      pendingWorkerCancellations.delete(workerTelegramId);
      return undefined;
    }
    return pending;
  },

  clearPendingCancellation(workerTelegramId: number) {
    pendingWorkerCancellations.delete(workerTelegramId);
  },
  /**
   * Helper to build dynamic HTML card and inline keyboard for any order state
   */
  generateOrderCard(order: Order, assignedWorkerName?: string): { cardHtml: string; replyMarkup: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } } {
    const firstItem = order.items?.[0];
    const itemsText = order.items
      ?.map(item => `  ▪️ <b>${item.product_name}</b> x ${item.quantity} = ৳${item.subtotal}`)
      .join('\n') || '  ▪️ No item details';

    const gameTitle = 
      order.customer_notes?.match(/Game:\s*([^|\n]+)/i)?.[1]?.trim() || 
      firstItem?.product_name || 
      'Top-Up Service';

    const workerName = assignedWorkerName || order.current_worker?.full_name || 'Worker Assigned';

    const playerUid = 
      order.player_uid || 
      (order.delivery_address as any)?.player_uid || 
      (order.delivery_address as any)?.name ||
      order.delivery_address?.address?.match(/(?:UID|Player UID|Email|ID):\s*([0-9a-zA-Z@._+-]+)/i)?.[1] ||
      order.customer_notes?.match(/(?:PUBG UID|UID|Player UID|Email|Account):\s*([0-9a-zA-Z@._+-]+)/i)?.[1] ||
      'N/A';

    const trxId = 
      order.trx_id || 
      (order.delivery_address as any)?.trx_id ||
      (order.delivery_address as any)?.notes ||
      order.customer_notes?.match(/(?:Proof|Trx):\s*([^|\n]+)/i)?.[1]?.trim() ||
      order.payments?.[0]?.transaction_id ||
      (order.payments?.[0] as any)?.trx_id ||
      'N/A';

    const paymentMethod = 
      order.payment_method || 
      (order.delivery_address as any)?.payment_method || 
      order.customer_notes?.match(/Pay:\s*([^|\n]+)/i)?.[1]?.trim() ||
      (order.payments?.[0] as any)?.payment_method ||
      order.payments?.[0]?.method ||
      'bKash/Nagad/Rocket';

    const accountInfo = getAccountFieldInfo(playerUid, gameTitle);
    const { methodLabel, proofLines } = formatPaymentDisplayForTelegram(trxId, paymentMethod);

    if (order.status === 'CLAIMED' || order.status === 'PROCESSING') {
      return {
        cardHtml: 
`✅ <b>ORDER CLAIMED / অর্ডার গ্রহণ করা হয়েছে</b>

📦 <b>Order ID:</b> <code>${order.order_id}</code>
🕹️ <b>Service / Game:</b> <b>${gameTitle}</b>
👷 <b>Assigned Worker:</b> <b>${workerName}</b>
${accountInfo.emoji} <b>${accountInfo.labelEn}:</b> <code>${playerUid}</code>
💰 <b>Total Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>
${proofLines}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>
📝 <b>Notes:</b> ${order.customer_notes || 'None'}

💎 <b>Packages:</b>
${itemsText}

<i>Worker: Process the order and click below when complete or cancel if invalid:</i>`,
        replyMarkup: {
          inline_keyboard: [
            [
              { text: '✅ Order Completed (ডেলিভারি সম্পন্ন)', callback_data: `status_delivered:${order.order_id}` }
            ],
            [
              { text: '❌ Cancel Order (বাতিল করুন)', callback_data: `cancel_prompt:${order.order_id}` }
            ]
          ]
        }
      };
    }

    if (order.status === 'OUT_FOR_DELIVERY') {
      return {
        cardHtml: 
`⚡ <b>PROCESSING ORDER / প্রসেসিং চলছে</b>

📦 <b>Order ID:</b> <code>${order.order_id}</code>
🕹️ <b>Service / Game:</b> <b>${gameTitle}</b>
👷 <b>Assigned Worker:</b> <b>${workerName}</b>
${accountInfo.emoji} <b>${accountInfo.labelEn}:</b> <code>${playerUid}</code>
💰 <b>Total Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>
${proofLines}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>

<i>Click below once order is completed or cancel if invalid:</i>`,
        replyMarkup: {
          inline_keyboard: [
            [
              { text: '✅ Order Completed', callback_data: `status_delivered:${order.order_id}` }
            ],
            [
              { text: '❌ Cancel Order (বাতিল করুন)', callback_data: `cancel_prompt:${order.order_id}` }
            ]
          ]
        }
      };
    }

    if (order.status === 'DELIVERED') {
      return {
        cardHtml: 
`🎉 <b>ORDER COMPLETED & DELIVERED / সম্পন্ন হয়েছে</b>

📦 <b>Order ID:</b> <code>${order.order_id}</code>
🕹️ <b>Service / Game:</b> <b>${gameTitle}</b>
${accountInfo.emoji} <b>${accountInfo.labelEn}:</b> <code>${playerUid}</code>
👷 <b>Processed by:</b> <b>${workerName}</b>
💰 <b>Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>
${proofLines}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>
💎 <b>Packages:</b>
${itemsText}
🕒 <b>Completed at:</b> ${new Date().toLocaleTimeString()}`,
        replyMarkup: {
          inline_keyboard: []
        }
      };
    }

    if (order.status === 'CANCELLED') {
      let cancelReason = 'No reason provided';
      if (order.customer_notes && !order.customer_notes.match(/^(?:PUBG UID|Free Fire UID|UID|Player UID|Account|Email|State Bot Order):/i)) {
        cancelReason = order.customer_notes;
      }
      return {
        cardHtml: 
`❌ <b>ORDER CANCELLED / অর্ডার বাতিল করা হয়েছে</b>

📦 <b>Order ID:</b> <code>${order.order_id}</code>
🕹️ <b>Service / Game:</b> <b>${gameTitle}</b>
${accountInfo.emoji} <b>${accountInfo.labelEn}:</b> <code>${playerUid}</code>
👷 <b>Handled by:</b> <b>${workerName}</b>
⚠️ <b>Reason / কারণ:</b> ${cancelReason}
💰 <b>Total Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>
${proofLines}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>
🕒 <b>Cancelled at:</b> ${new Date().toLocaleTimeString()}

<i>⚠️ This order is cancelled. No further worker action needed.</i>`,
        replyMarkup: {
          inline_keyboard: []
        }
      };
    }

    // Default: PENDING_CLAIM / PENDING_PAYMENT
    return {
      cardHtml: 
`🚨 <b>NEW ORDER / নতুন অর্ডার</b>

📦 <b>Order ID:</b> <code>${order.order_id}</code>
🕹️ <b>Service / Game:</b> <b>${gameTitle}</b>
${accountInfo.emoji} <b>${accountInfo.labelEn}:</b> <code>${playerUid}</code>
💰 <b>Total Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>
${proofLines}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>
📝 <b>Notes:</b> ${order.customer_notes || 'None'}

💎 <b>Packages:</b>
${itemsText}

<i>Click below to claim and process this order:</i>`,
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: '⚡ Claim Order (অর্ডার গ্রহণ করুন)',
              callback_data: `claim:${order.order_id}`
            },
            {
              text: '❌ Cancel (বাতিল)',
              callback_data: `cancel_prompt:${order.order_id}`
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

    const parts = data.split(':');
    const action = parts[0];
    const orderIdCode = (parts[1] || '').trim();
    const extraParam = parts.slice(2).join(':');
    const workerName = [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || `Worker-${from.id}`;

    console.log(`[Telegram Callback] Action: "${action}" | OrderCode: "${orderIdCode}" | Extra: "${extraParam}" | Worker: "${workerName}" (ID: ${from.id})`);

    const existingOrder = await db.getOrderByCode(orderIdCode);
    if (!existingOrder) {
      await this.answerCallbackQuery(id, '⚠️ Order not found in database', true);
      return { success: false, message: 'Order not found' };
    }

    if (existingOrder.status === 'CANCELLED') {
      await this.answerCallbackQuery(
        id,
        '❌ এই অর্ডারটি অ্যাডমিন কর্তৃক বাতিল করা হয়েছে (This order was cancelled by Admin).',
        true
      );
      return { success: false, message: 'Order is cancelled' };
    }

    const assignedWorker = existingOrder.current_worker ||
      existingOrder.assignments?.find(a => ['CLAIMED', 'PROCESSING', 'OUT_FOR_DELIVERY'].includes(a.status))?.worker;
    const assignedTelegramId = assignedWorker?.telegram_user_id;
    const assignedWorkerName = assignedWorker?.full_name || 'অন্য একজন কর্মী';

    // 1. ACTION: CLAIM ORDER
    if (action === 'claim') {
      // If already claimed by another worker
      if (
        ['CLAIMED', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(existingOrder.status) &&
        assignedTelegramId &&
        assignedTelegramId !== from.id
      ) {
        await this.answerCallbackQuery(
          id,
          `⛔ একশন বাতিল!\nএই অর্ডারটি ইতোমধ্যে [${assignedWorkerName}] ক্লেইম করেছেন। অন্য কোনো কর্মী এতে একশন নিতে পারবেন না (শুধুমাত্র অ্যাডমিন প্যানেল পরিবর্তন করতে পারে)।`,
          true
        );
        return { success: false, message: `Order already claimed by ${assignedWorkerName}` };
      }

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
      // Must be claimed first
      if (!assignedTelegramId && (existingOrder.status === 'PENDING_CLAIM' || existingOrder.status === 'PENDING_PAYMENT')) {
        await this.answerCallbackQuery(id, `⚠️ প্রথমে 'Claim Top-Up' বাটনে ক্লিক করে অর্ডারটি গ্রহণ করুন!`, true);
        return { success: false, message: 'Order must be claimed first' };
      }

      // Check worker lock
      if (assignedTelegramId && assignedTelegramId !== from.id) {
        await this.answerCallbackQuery(
          id,
          `⛔ একশন বাতিল!\nএই অর্ডারটি [${assignedWorkerName}] ক্লেইম করেছেন। শুধুমাত্র তিনি অথবা অ্যাডমিন প্যানেল এতে একশন নিতে পারবেন।`,
          true
        );
        return { success: false, message: `Unauthorized: Claimed by ${assignedWorkerName}` };
      }

      try {
        const updateResult = await db.updateOrderStatus(orderIdCode, 'OUT_FOR_DELIVERY', { workerTelegramId: from.id });
        if (!updateResult.success) {
          await this.answerCallbackQuery(id, `⚠️ ${updateResult.message}`, true);
          return { success: false, message: updateResult.message || 'Update failed' };
        }
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
      // Must be claimed first
      if (!assignedTelegramId && (existingOrder.status === 'PENDING_CLAIM' || existingOrder.status === 'PENDING_PAYMENT')) {
        await this.answerCallbackQuery(id, `⚠️ প্রথমে 'Claim Top-Up' বাটনে ক্লিক করে অর্ডারটি গ্রহণ করুন!`, true);
        return { success: false, message: 'Order must be claimed first' };
      }

      // Check worker lock
      if (assignedTelegramId && assignedTelegramId !== from.id) {
        await this.answerCallbackQuery(
          id,
          `⛔ একশন বাতিল!\nএই অর্ডারটি [${assignedWorkerName}] ক্লেইম করেছেন। শুধুমাত্র তিনি অথবা অ্যাডমিন প্যানেল এটি সম্পন্ন করতে পারবেন।`,
          true
        );
        return { success: false, message: `Unauthorized: Claimed by ${assignedWorkerName}` };
      }

      try {
        const updateResult = await db.updateOrderStatus(orderIdCode, 'DELIVERED', { workerTelegramId: from.id });
        if (!updateResult.success) {
          await this.answerCallbackQuery(id, `⚠️ ${updateResult.message}`, true);
          return { success: false, message: updateResult.message || 'Delivery failed' };
        }
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

    // 4. ACTION: CANCEL PROMPT (Show Cancellation Reasons)
    if (action === 'cancel_prompt') {
      // Check worker lock
      if (assignedTelegramId && assignedTelegramId !== from.id) {
        await this.answerCallbackQuery(
          id,
          `⛔ একশন বাতিল!\nএই অর্ডারটি [${assignedWorkerName}] ক্লেইম করেছেন। শুধুমাত্র তিনি অথবা অ্যাডমিন প্যানেল এটি বাতিল করতে পারবেন।`,
          true
        );
        return { success: false, message: `Unauthorized: Claimed by ${assignedWorkerName}` };
      }

      // Reset any active pending custom cancellation mode if user navigated back to options
      this.clearPendingCancellation(from.id);

      const firstItem = existingOrder.items?.[0];
      const prodName = firstItem?.product_name || '';
      const playerUid = 
        existingOrder.player_uid || 
        (existingOrder.delivery_address as any)?.player_uid || 
        (existingOrder.delivery_address as any)?.name ||
        existingOrder.delivery_address?.address?.match(/(?:UID|Player UID|Email|Gmail|Account|ID):\s*([0-9a-zA-Z@._+-]+)/i)?.[1] ||
        'N/A';
      const accountInfo = getAccountFieldInfo(playerUid, prodName);

      const promptHtml = 
`⚠️ <b>CANCEL ORDER / অর্ডার বাতিলের কারণ নির্বাচন করুন</b>

📦 <b>Order ID:</b> <code>${existingOrder.order_id}</code>
${accountInfo.emoji} <b>${accountInfo.labelEn}:</b> <code>${playerUid}</code>
👷 <b>Worker:</b> <b>${workerName}</b>

<i>অনুগ্রহ করে নিচে থেকে বাতিলের সুনির্দিষ্ট কারণ নির্বাচন করুন অথবা নিজে কারণ লিখুন:</i>`;

      const promptMarkup = {
        inline_keyboard: [
          [
            { text: `🚫 ভুল ${accountInfo.labelBn} / Invalid`, callback_data: `cancel_confirm:${existingOrder.order_id}:Invalid ${accountInfo.labelEn} (ভুল তথ্য)` }
          ],
          [
            { text: '💳 ভুয়া / ইনভ্যালিড TrxID', callback_data: `cancel_confirm:${existingOrder.order_id}:Fake or Invalid TrxID (পেমেন্ট মেলেনি)` }
          ],
          [
            { text: '📉 স্টক শেষ / সার্ভার সমস্যা', callback_data: `cancel_confirm:${existingOrder.order_id}:Out of Stock / Server Error` }
          ],
          [
            { text: '✍️ নিজে কারণ লিখুন (Write Custom Reason)', callback_data: `cancel_custom_prompt:${existingOrder.order_id}` }
          ],
          [
            { text: '👤 কাস্টমার রিকোয়েস্ট (Customer Requested)', callback_data: `cancel_confirm:${existingOrder.order_id}:Customer Requested` }
          ],
          [
            { text: '🔙 ফিরে যান (Back to Order)', callback_data: `cancel_back:${existingOrder.order_id}` }
          ]
        ]
      };

      if (message) {
        await this.editMessageText(message.chat.id, message.message_id, promptHtml, promptMarkup);
      }

      await this.answerCallbackQuery(id, 'বাতিলের কারণ নির্বাচন করুন বা লিখুন', false);
      return { success: true, message: 'Cancellation reason prompt displayed' };
    }

    // 4b. ACTION: CANCEL CUSTOM PROMPT (Worker wants to write custom reason)
    if (action === 'cancel_custom_prompt') {
      // Check worker lock
      if (assignedTelegramId && assignedTelegramId !== from.id) {
        await this.answerCallbackQuery(
          id,
          `⛔ একশন বাতিল!\nএই অর্ডারটি [${assignedWorkerName}] ক্লেইম করেছেন। শুধুমাত্র তিনি অথবা অ্যাডমিন প্যানেল এটি বাতিল করতে পারবেন।`,
          true
        );
        return { success: false, message: `Unauthorized: Claimed by ${assignedWorkerName}` };
      }

      const firstItem = existingOrder.items?.[0];
      const prodName = firstItem?.product_name || '';
      const playerUid = 
        existingOrder.player_uid || 
        (existingOrder.delivery_address as any)?.player_uid || 
        (existingOrder.delivery_address as any)?.name ||
        existingOrder.delivery_address?.address?.match(/(?:UID|Player UID|Email|Gmail|Account|ID):\s*([0-9a-zA-Z@._+-]+)/i)?.[1] ||
        'N/A';
      const accountInfo = getAccountFieldInfo(playerUid, prodName);

      // Register pending cancellation session for this worker
      this.setPendingCancellation(from.id, {
        orderIdCode: existingOrder.order_id,
        workerTelegramId: from.id,
        workerName,
        chatId: message?.chat.id,
        messageId: message?.message_id
      });

      const customPromptHtml = 
`✍️ <b>CANCEL ORDER / অর্ডার বাতিলের কারণ লিখুন</b>

📦 <b>Order ID:</b> <code>${existingOrder.order_id}</code>
${accountInfo.emoji} <b>${accountInfo.labelEn}:</b> <code>${playerUid}</code>
👷 <b>Worker:</b> <b>${workerName}</b>

<i>অনুগ্রহ করে নিচে রিপ্লাই (Reply) করে অথবা সরাসরি চ্যাটে বাতিলের কারণ লিখে পাঠান।</i>

<b>উদাহরণ:</b>
• আইডি পাসওয়ার্ড ভুল
• ২-স্টেপ ভেরিফিকেশন অন, ব্যাকআপ কোড দিন
• প্লেয়ার লেভেল কম, গিফট দেওয়া যাচ্ছে না
• পেমেন্টের তথ্য মেলেনি

<i>(বাতিল করতে না চাইলে নিচের 'ফিরে যান' বাটনে ক্লিক করুন)</i>`;

      const customPromptMarkup = {
        inline_keyboard: [
          [
            { text: '🔙 কারণ তালিকায় ফিরুন (Reason List)', callback_data: `cancel_prompt:${existingOrder.order_id}` }
          ],
          [
            { text: '❌ ফিরে যান (Back to Order)', callback_data: `cancel_back:${existingOrder.order_id}` }
          ]
        ]
      };

      if (message) {
        await this.editMessageText(message.chat.id, message.message_id, customPromptHtml, customPromptMarkup);

        // Send a force-reply trigger message so Telegram automatically focuses input in reply mode
        try {
          await this.sendMessage(message.chat.id, `✍️ <b>[${workerName}]</b>, #${existingOrder.order_id} অর্ডারটি বাতিলের কারণ লিখে পাঠান:\n<i>(এই মেসেজটিতে রিপ্লাই করে কারণটি টাইপ করুন)</i>`, {
            reply_to_message_id: message.message_id,
            reply_markup: {
              force_reply: true,
              selective: true,
              input_field_placeholder: 'অর্ডার বাতিলের সুনির্দিষ্ট কারণ লিখুন...'
            }
          });
        } catch (promptErr) {
          console.error('Failed to dispatch force-reply prompt:', promptErr);
        }
      }

      await this.answerCallbackQuery(id, '✍️ এবার চ্যাটে বাতিলের কারণ লিখে পাঠান', false);
      return { success: true, message: 'Custom cancellation prompt active' };
    }

    // 5. ACTION: CANCEL BACK (Return to claimed order view)
    if (action === 'cancel_back') {
      this.clearPendingCancellation(from.id);
      if (message) {
        const { cardHtml, replyMarkup } = this.generateOrderCard(existingOrder, assignedWorkerName || workerName);
        await this.editMessageText(message.chat.id, message.message_id, cardHtml, replyMarkup);
      }
      await this.answerCallbackQuery(id, 'ফিরে আসা হয়েছে', false);
      return { success: true, message: 'Returned to order view' };
    }

    // 6. ACTION: CANCEL CONFIRM (Execute cancellation with reason)
    if (action === 'cancel_confirm') {
      // Check worker lock
      if (assignedTelegramId && assignedTelegramId !== from.id) {
        await this.answerCallbackQuery(
          id,
          `⛔ একশন বাতিল!\nএই অর্ডারটি [${assignedWorkerName}] ক্লেইম করেছেন। শুধুমাত্র তিনি অথবা অ্যাডমিন প্যানেল এটি বাতিল করতে পারবেন।`,
          true
        );
        return { success: false, message: `Unauthorized: Claimed by ${assignedWorkerName}` };
      }

      const parts = data.split(':');
      const targetOrderIdCode = parts[1];
      const cancelReason = parts.slice(2).join(':') || 'Worker cancelled';

      const result = await this.executeOrderCancellation({
        orderIdCode: targetOrderIdCode,
        cancelReason,
        workerTelegramId: from.id,
        workerName,
        workerUsername: from.username,
        chatId: message?.chat.id,
        messageId: message?.message_id
      });

      if (!result.success) {
        await this.answerCallbackQuery(id, `⚠️ ${result.message}`, true);
        return { success: false, message: result.message };
      }

      await this.answerCallbackQuery(id, `❌ অর্ডারটি বাতিল করা হয়েছে। কারণ: ${cancelReason}`, true);
      return { success: true, message: `Order cancelled: ${cancelReason}` };
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
  },

  /**
   * Send a general HTML message to a chat (e.g. group or user)
   */
  async sendMessage(
    chatId: string | number,
    text: string,
    options?: {
      parse_mode?: string;
      reply_markup?: unknown;
      reply_to_message_id?: number;
    }
  ): Promise<{ ok: boolean; result?: { message_id: number } }> {
    if (!env.telegram.isConfigured) return { ok: false };
    try {
      const response = await fetch(`${env.telegram.apiUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: options?.parse_mode || 'HTML',
          reply_markup: options?.reply_markup,
          reply_to_message_id: options?.reply_to_message_id
        })
      });
      return await response.json();
    } catch (e) {
      console.error('Error sending telegram message:', e);
      return { ok: false };
    }
  },

  /**
   * Execute order cancellation with either preset or custom reason
   */
  async executeOrderCancellation(params: {
    orderIdCode: string;
    cancelReason: string;
    workerTelegramId: number;
    workerName: string;
    workerUsername?: string;
    chatId?: string | number;
    messageId?: number;
  }): Promise<{ success: boolean; message: string; order?: Order }> {
    const { orderIdCode, cancelReason, workerTelegramId, workerName, workerUsername, chatId, messageId } = params;

    const existingOrder = await db.getOrderByCode(orderIdCode);
    if (!existingOrder) {
      return { success: false, message: 'অর্ডারটি খুঁজে পাওয়া যায়নি।' };
    }

    if (existingOrder.status === 'CANCELLED') {
      return { success: false, message: 'অর্ডারটি ইতোমধ্যে বাতিল করা হয়েছে।' };
    }

    const assignedWorker = existingOrder.current_worker ||
      existingOrder.assignments?.find(a => ['CLAIMED', 'PROCESSING', 'OUT_FOR_DELIVERY'].includes(a.status))?.worker;
    const assignedTelegramId = assignedWorker?.telegram_user_id;
    const assignedWorkerName = assignedWorker?.full_name || 'অন্য একজন কর্মী';

    if (assignedTelegramId && assignedTelegramId !== workerTelegramId) {
      return {
        success: false,
        message: `⛔ এই অর্ডারটি [${assignedWorkerName}] ক্লেইম করেছেন। শুধুমাত্র তিনি অথবা অ্যাডমিন এটি বাতিল করতে পারবেন।`
      };
    }

    // If order was unclaimed, claim/record this worker so order history reflects who handled it
    if (!assignedTelegramId && (existingOrder.status === 'PENDING_CLAIM' || existingOrder.status === 'PENDING_PAYMENT')) {
      await db.claimOrderAtomic({
        orderIdCode,
        telegramUserId: workerTelegramId,
        workerName,
        telegramUsername: workerUsername
      }).catch(err => console.warn('[Worker Cancel Claim Fallback]:', err));
    }

    const updateResult = await db.updateOrderStatus(orderIdCode, 'CANCELLED', {
      workerTelegramId,
      notes: cancelReason
    });

    if (!updateResult.success) {
      return { success: false, message: updateResult.message };
    }

    const order = updateResult.order || existingOrder;
    order.customer_notes = cancelReason;

    // Update Telegram message card in group
    const targetChatId = chatId || env.telegram.workerGroupId;
    const targetMsgId = messageId || order.telegram_message_id;

    if (targetChatId && targetMsgId) {
      const { cardHtml, replyMarkup } = this.generateOrderCard(order, workerName);
      await this.editMessageText(targetChatId, targetMsgId, cardHtml, replyMarkup);
    }

    // Trigger WhatsApp customer notification with custom reason
    whatsappService.sendOrderCancelledNotification(order, cancelReason).catch(err => {
      console.error('[Telegram->WhatsApp Notify Error on Custom Cancel]:', err);
    });

    // Clear pending cancellation state for this worker
    this.clearPendingCancellation(workerTelegramId);

    return { success: true, message: `Order #${orderIdCode} cancelled: ${cancelReason}`, order };
  },

  /**
   * Handle incoming text messages from workers in the Telegram group
   */
  async handleWorkerTextMessage(message: {
    message_id: number;
    from: { id: number; first_name: string; last_name?: string; username?: string };
    chat: { id: number | string };
    text: string;
    reply_to_message?: { message_id: number; text?: string };
  }): Promise<{ handled: boolean; success?: boolean; message?: string }> {
    const workerId = message.from.id;
    const workerName = [message.from.first_name, message.from.last_name].filter(Boolean).join(' ') || message.from.username || `Worker-${workerId}`;
    const text = message.text.trim();
    const replyText = message.reply_to_message?.text || '';

    // Ignore non-cancel slash commands
    if (text === '/start' || text === '/help' || text === '/stats') {
      return { handled: false };
    }

    // 1. Check for command /cancel [order_id] [reason]
    const cancelCmdMatch = text.match(/^\/cancel(?:\s+([A-Za-z0-9-]+))?(?:\s+(.+))?$/i);
    if (cancelCmdMatch) {
      let targetOrderCode = cancelCmdMatch[1]?.trim();
      let cmdReason = cancelCmdMatch[2]?.trim();

      // If user replied to an order message with "/cancel <reason>"
      if (!targetOrderCode || targetOrderCode.length < 5 || !targetOrderCode.toUpperCase().startsWith('WAP-')) {
        const replyOrderMatch = replyText.match(/Order ID:\s*([A-Za-z0-9-]+)/i) || replyText.match(/#(WAP-[0-9]+-[0-9]+)/i);
        if (replyOrderMatch) {
          cmdReason = [targetOrderCode, cmdReason].filter(Boolean).join(' ');
          targetOrderCode = replyOrderMatch[1];
        }
      }

      // Check if user has an active pending cancellation
      const pending = this.getPendingCancellation(workerId);
      if (!targetOrderCode && pending) {
        targetOrderCode = pending.orderIdCode;
        cmdReason = [cancelCmdMatch[1], cancelCmdMatch[2]].filter(Boolean).join(' ');
      }

      // If worker just typed "/cancel" without any reason
      if (!cmdReason && pending) {
        this.clearPendingCancellation(workerId);
        await this.sendMessage(message.chat.id, `✅ <b>[${workerName}]</b>, #${pending.orderIdCode} অর্ডার বাতিলের প্রক্রিয়া প্রত্যাহার করা হয়েছে।`);
        return { handled: true, success: true, message: 'Cancellation aborted' };
      }

      if (targetOrderCode && cmdReason) {
        const result = await this.executeOrderCancellation({
          orderIdCode: targetOrderCode,
          cancelReason: cmdReason,
          workerTelegramId: workerId,
          workerName,
          workerUsername: message.from.username,
          chatId: message.chat.id,
          messageId: pending?.messageId
        });

        if (result.success) {
          await this.sendMessage(
            message.chat.id,
            `❌ <b>অর্ডার #${targetOrderCode} বাতিল করা হয়েছে</b>\n\n⚠️ <b>কারণ:</b> ${cmdReason}\n👷 <b>কর্মী:</b> <b>${workerName}</b>\n\n<i>কাস্টমারকে হোয়াটসঅ্যাপে বাতিলের কারণ জানানো হয়েছে।</i>`,
            { reply_to_message_id: message.message_id }
          );
        } else {
          await this.sendMessage(
            message.chat.id,
            `⚠️ অর্ডার #${targetOrderCode} বাতিল করা যায়নি: ${result.message}`,
            { reply_to_message_id: message.message_id }
          );
        }
        return { handled: true, ...result };
      }
    }

    // 2. Check for active pending cancellation session
    const pending = this.getPendingCancellation(workerId);
    if (pending) {
      const cancelReason = text;

      const result = await this.executeOrderCancellation({
        orderIdCode: pending.orderIdCode,
        cancelReason,
        workerTelegramId: workerId,
        workerName,
        workerUsername: message.from.username,
        chatId: message.chat.id,
        messageId: pending.messageId
      });

      if (result.success) {
        await this.sendMessage(
          message.chat.id,
          `❌ <b>অর্ডার #${pending.orderIdCode} বাতিল করা হয়েছে</b>\n\n⚠️ <b>কারণ:</b> ${cancelReason}\n👷 <b>কর্মী:</b> <b>${workerName}</b>\n\n<i>কাস্টমারকে হোয়াটসঅ্যাপে বাতিলের কারণ পাঠানো হয়েছে।</i>`,
          { reply_to_message_id: message.message_id }
        );
      } else {
        await this.sendMessage(
          message.chat.id,
          `⚠️ অর্ডার #${pending.orderIdCode} বাতিল করা যায়নি: ${result.message}`,
          { reply_to_message_id: message.message_id }
        );
      }

      return { handled: true, ...result };
    }

    // 3. Check if message is a direct reply to an order card prompt asking for cancellation reason
    const replyOrderMatch = replyText.match(/Order ID:\s*([A-Za-z0-9-]+)/i) || replyText.match(/#(WAP-[0-9]+-[0-9]+)/i);
    if (replyOrderMatch && (replyText.includes('WRITE CANCELLATION REASON') || replyText.includes('বাতিলের কারণ লিখুন'))) {
      const orderIdCode = replyOrderMatch[1];
      const cancelReason = text;

      const result = await this.executeOrderCancellation({
        orderIdCode,
        cancelReason,
        workerTelegramId: workerId,
        workerName,
        workerUsername: message.from.username,
        chatId: message.chat.id,
        messageId: message.reply_to_message?.message_id
      });

      if (result.success) {
        await this.sendMessage(
          message.chat.id,
          `❌ <b>অর্ডার #${orderIdCode} বাতিল করা হয়েছে</b>\n\n⚠️ <b>কারণ:</b> ${cancelReason}\n👷 <b>কর্মী:</b> <b>${workerName}</b>`,
          { reply_to_message_id: message.message_id }
        );
      } else {
        await this.sendMessage(
          message.chat.id,
          `⚠️ অর্ডার বাতিল করা যায়নি: ${result.message}`,
          { reply_to_message_id: message.message_id }
        );
      }

      return { handled: true, ...result };
    }

    return { handled: false };
  }
};
