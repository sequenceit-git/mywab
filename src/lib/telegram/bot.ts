import { Order } from '@/types';
import { db } from '../db';
import { env } from '../config/env';
import { telegramClient } from './client';
import {
  generateOrderCard,
  resolveCancelReason,
  sanitizeReplyMarkup,
  isQrLoginOrder,
  hasQrCodeBeenSent,
  cancellationStore,
  PendingWorkerCancellation
} from './card-builder';
import { handleCallbackQuery } from './callback-handlers';
import {
  executeOrderCancellation,
  handleWorkerTextMessage,
  handleWorkerPhotoMessage
} from './message-handlers';

export * from './client';
export * from './card-builder';
export * from './callback-handlers';
export * from './message-handlers';
export { telegramQueue } from './queue';

export const telegramBot = {
  // Card & markup generation
  generateOrderCard,
  sanitizeReplyMarkup,
  resolveCancelReason,
  isQrLoginOrder,
  hasQrCodeBeenSent,

  // Cancellation session tracking
  setPendingCancellation: (workerTelegramId: number, data: Omit<PendingWorkerCancellation, 'createdAt'>) =>
    cancellationStore.setPendingCancellation(workerTelegramId, data),
  getPendingCancellation: (workerTelegramId: number) =>
    cancellationStore.getPendingCancellation(workerTelegramId),
  clearPendingCancellation: (workerTelegramId: number) =>
    cancellationStore.clearPendingCancellation(workerTelegramId),

  // Low-level Telegram API client delegates
  answerCallbackQuery: telegramClient.answerCallbackQuery,
  deleteMessage: telegramClient.deleteMessage,
  editMessageReplyMarkup: telegramClient.editMessageReplyMarkup,
  editMessageText: telegramClient.editMessageText,
  sendMessage: telegramClient.sendMessage,

  // Higher-level handlers
  handleCallbackQuery,
  executeOrderCancellation,
  handleWorkerTextMessage,
  handleWorkerPhotoMessage,

  /**
   * Send new order card to the Telegram Worker Group with Claim button
   */
  async dispatchNewOrder(order: Order, queueCount?: number): Promise<{ success: boolean; messageId?: number; error?: string }> {
    if (!env.telegram.isConfigured) {
      const errorMsg = 'Telegram Worker Bot not configured in environment';
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    const { cardHtml, replyMarkup } = generateOrderCard(order, undefined, queueCount);

    try {
      const sendRes = await telegramClient.sendMessage(env.telegram.workerGroupId, cardHtml, {
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      });

      if (sendRes.ok && sendRes.result?.message_id) {
        order.telegram_message_id = sendRes.result.message_id;
        await db.updateOrderTelegramMessageId(order.id, sendRes.result.message_id);
        return { success: true, messageId: sendRes.result.message_id };
      }
      return { success: false, error: 'Failed to dispatch to Telegram' };
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

    const { cardHtml, replyMarkup } = generateOrderCard(order, options.workerName);
    const prevMsgId = order.telegram_message_id;

    console.log(`[Telegram Sync] Syncing Order #${order.order_id} -> Status: ${order.status} | Prev Msg ID: ${prevMsgId}`);

    // If we want to delete previous message and post new state
    if (options.deletePrevious && prevMsgId) {
      const deleted = await telegramClient.deleteMessage(env.telegram.workerGroupId, prevMsgId);
      console.log(`[Telegram Sync] Deleted previous message ${prevMsgId}: ${deleted}`);
    }

    // Send the new status card
    try {
      const sendRes = await telegramClient.sendMessage(env.telegram.workerGroupId, cardHtml, {
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      });

      if (sendRes.ok && sendRes.result?.message_id) {
        const newMsgId = sendRes.result.message_id;
        order.telegram_message_id = newMsgId;
        await db.updateOrderTelegramMessageId(order.id, newMsgId);
        return { success: true, messageId: newMsgId };
      }

      // Fallback: If sendMessage failed after delete attempt or if delete was skipped, try editMessageText on prevMsgId
      if (prevMsgId) {
        console.warn(`[Telegram Sync] Falling back to editMessageText for msg ${prevMsgId}`);
        await telegramClient.editMessageText(env.telegram.workerGroupId, prevMsgId, cardHtml, replyMarkup);
        return { success: true, messageId: prevMsgId };
      }

      return { success: false, error: 'Failed to sync to Telegram' };
    } catch (err) {
      console.error('[Telegram Sync Network Error]:', err);
      return { success: false, error: String(err) };
    }
  },

  /**
   * Notify worker in Telegram when customer clicks "QR Done" or "Need New QR" on WhatsApp
   */
  async notifyWorkerQrAction(orderIdCode: string, action: 'SCANNED' | 'REFRESH_REQUESTED'): Promise<void> {
    if (!env.telegram.isConfigured) return;

    const order = await db.getOrderByCode(orderIdCode);
    if (!order) return;

    const workerName = order.current_worker?.full_name || 'Worker';

    if (action === 'SCANNED') {
      order.status = 'PROCESSING';
      const scannedNotes = `${order.customer_notes || ''} | Customer Scanned QR`;
      order.customer_notes = scannedNotes;
      await db.updateOrderStatus(order.order_id, 'PROCESSING', {
        notes: scannedNotes
      });

      // Remove the previous card so there are never duplicate messages with buttons
      const prevMsgId = order.telegram_message_id;
      if (prevMsgId) {
        try {
          await telegramClient.deleteMessage(env.telegram.workerGroupId, prevMsgId);
          console.log(`[Telegram Scanned Sync] Deleted previous order card #${prevMsgId} for Order #${order.order_id}`);
        } catch (delErr) {
          console.warn('[Telegram Scanned Sync] Failed to delete previous card:', delErr);
        }
        await telegramClient.editMessageReplyMarkup(env.telegram.workerGroupId, prevMsgId, { inline_keyboard: [] }).catch(() => {});
      }

      const { cardHtml, replyMarkup } = generateOrderCard(order, workerName);
      const msg = 
`🎯 <b>[Order #${order.order_id}] CUSTOMER SCANNED QR CODE! / স্ক্যান সম্পন্ন</b>

${cardHtml}`;

      const sendRes = await telegramClient.sendMessage(env.telegram.workerGroupId, msg, { reply_markup: sanitizeReplyMarkup(replyMarkup) });
      if (sendRes.ok && sendRes.result?.message_id) {
        order.telegram_message_id = sendRes.result.message_id;
        await db.updateOrderTelegramMessageId(order.id, sendRes.result.message_id);
      }
    } else if (action === 'REFRESH_REQUESTED') {
      const refreshNotes = `${order.customer_notes || ''} | QR_REFRESH_REQUESTED:${new Date().toLocaleTimeString()}`;
      order.customer_notes = refreshNotes;
      await db.updateOrderStatus(order.order_id, order.status, {
        notes: refreshNotes
      });

      const prevMsgId = order.telegram_message_id;
      if (prevMsgId) {
        try {
          await telegramClient.deleteMessage(env.telegram.workerGroupId, prevMsgId);
        } catch (delErr) {
          console.warn('[Telegram Refresh Sync] Failed to delete previous card:', delErr);
        }
        await telegramClient.editMessageReplyMarkup(env.telegram.workerGroupId, prevMsgId, { inline_keyboard: [] }).catch(() => {});
      }

      const refreshMarkup = {
        inline_keyboard: [
          [
            { text: '📸 Send New QR (নতুন QR পাঠান)', callback_data: `qr_resend_hint:${order.order_id}` }
          ],
          [
            { text: '❌ Cancel Order (বাতিল করুন)', callback_data: `cancel_prompt:${order.order_id}` }
          ]
        ]
      };

      const msg = 
`⚠️ <b>[Order #${order.order_id}] CUSTOMER REQUESTED NEW QR! / নতুন কিউআর প্রয়োজন</b>

👷 <b>Worker:</b> <b>${workerName}</b>
📱 <b>Customer:</b> <code>${order.delivery_phone}</code>
⏱️ <b>কারণ:</b> পূর্বের QR কোডের ৫ মিনিট মেয়াদ শেষ হয়ে গেছে বা স্ক্যান হয়নি।

📸 <b>একশন:</b> দয়া করে দ্রুত একটি <b>নতুন Login QR কোড স্ক্রিনশট</b> এই গ্রুপে পাঠান (Reply to Order)।`;

      const sendRes = await telegramClient.sendMessage(env.telegram.workerGroupId, msg, { reply_markup: sanitizeReplyMarkup(refreshMarkup) });
      if (sendRes.ok && sendRes.result?.message_id) {
        order.telegram_message_id = sendRes.result.message_id;
        await db.updateOrderTelegramMessageId(order.id, sendRes.result.message_id);
      }
    }
  },

  /**
   * Notify worker in Telegram when customer sends the email verification code on WhatsApp
   * (PUBG KR / eFootball "code method" fulfillment)
   */
  async notifyWorkerCodeReceived(orderIdCode: string, code: string): Promise<void> {
    if (!env.telegram.isConfigured) return;

    const order = await db.getOrderByCode(orderIdCode);
    if (!order) return;

    const workerName = order.current_worker?.full_name || 'Worker';

    const updatedNotes = `${order.customer_notes || ''} | CODE_RECEIVED:${code}`;
    await db.updateOrderStatus(order.order_id, order.status, { notes: updatedNotes });

    const refreshedOrder = (await db.getOrderByCode(order.order_id)) || order;

    // Remove the previous card so there are never duplicate messages with buttons
    const prevMsgId = refreshedOrder.telegram_message_id;
    if (prevMsgId) {
      try {
        await telegramClient.deleteMessage(env.telegram.workerGroupId, prevMsgId);
        console.log(`[Telegram Code Received] Deleted previous order card #${prevMsgId} for Order #${refreshedOrder.order_id}`);
      } catch (delErr) {
        console.warn('[Telegram Code Received] Failed to delete previous card:', delErr);
        await telegramClient.editMessageReplyMarkup(env.telegram.workerGroupId, prevMsgId, { inline_keyboard: [] });
      }
    }

    const { cardHtml, replyMarkup } = generateOrderCard(refreshedOrder, workerName);
    const msg =
`📨 <b>[Order #${refreshedOrder.order_id}] CUSTOMER SENT CODE! / কাস্টমার কোড পাঠিয়েছেন</b>

🔑 <b>Code:</b> <code>${code}</code>

${cardHtml}`;

    const sendRes = await telegramClient.sendMessage(env.telegram.workerGroupId, msg, { reply_markup: sanitizeReplyMarkup(replyMarkup) });
    if (sendRes.ok && sendRes.result?.message_id) {
      refreshedOrder.telegram_message_id = sendRes.result.message_id;
      await db.updateOrderTelegramMessageId(refreshedOrder.id, sendRes.result.message_id);
    }
  },

  /**
   * Notify Telegram group when a customer requests human support or uses /human
   */
  async notifyHumanSupportRequest(data: {
    phone: string;
    customerName?: string;
    messageText?: string;
    conversationId?: string;
  }): Promise<boolean> {
    if (!env.telegram.isConfigured) return false;

    const name = data.customerName || 'Customer';
    const cleanPhone = data.phone.replace(/\D/g, '');
    const textPreview = data.messageText ? data.messageText.slice(0, 300) : 'Requested Human Support';

    const alertHtml =
`🚨 <b>HUMAN SUPPORT REQUESTED / হিউম্যান সাপোর্ট রিকোয়েস্ট</b>

👤 <b>Customer:</b> <b>${name}</b>
📞 <b>Phone:</b> <code>${data.phone}</code>
💬 <b>Message:</b> <i>${textPreview}</i>
🕒 <b>Time:</b> ${new Date().toLocaleTimeString()}

⚠️ <i>এই কাস্টমারের জন্য বট অটো-অফ (Human Takeover) করা হয়েছে। অনুগ্রহ করে অ্যাডমিন প্যানেল বা WhatsApp থেকে কাস্টমারকে উত্তর দিন।</i>`;

    const inlineKeyboard = [
      [
        {
          text: '💬 Open WhatsApp Chat',
          url: `https://wa.me/${cleanPhone}`
        }
      ]
    ];

    try {
      const sendRes = await telegramClient.sendMessage(env.telegram.workerGroupId, alertHtml, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: inlineKeyboard }
      });
      return Boolean(sendRes.ok);
    } catch (err) {
      console.error('[Telegram Human Support Alert Error]:', err);
      return false;
    }
  }
};

