import { db } from '../../db';
import { whatsappService } from '../../whatsapp/service';
import { telegramClient } from '../../telegram/client';
import { generateOrderCard, sanitizeReplyMarkup } from '../../telegram/card-builder';
import { env } from '../../config/env';
import { Order } from '@/types';

/**
 * Check if an order is a Netflix account order
 */
export function isNetflixOrder(order?: { items?: Array<{ product_name?: string }>; customer_notes?: string | null }): boolean {
  if (!order) return false;
  const itemNames = (order.items || []).map(i => i.product_name?.toLowerCase() || '').join(' ');
  const notes = (order.customer_notes || '').toLowerCase();
  return itemNames.includes('netflix') || notes.includes('netflix');
}

/**
 * Find active Netflix order for a customer's phone
 */
export async function findActiveNetflixOrder(phone: string): Promise<Order | null> {
  const cleanPhone = phone.replace(/\D/g, '');
  const activeOrders = await db.getOrders({ limit: 15 });
  
  const match = activeOrders.find(o => {
    const orderPhone = (o.delivery_phone || '').replace(/\D/g, '');
    const isPhoneMatch = orderPhone.includes(cleanPhone) || cleanPhone.includes(orderPhone);
    const isActive = ['PENDING_CLAIM', 'CLAIMED', 'PROCESSING', 'OUT_FOR_DELIVERY'].includes(o.status);
    return isPhoneMatch && isActive && isNetflixOrder(o);
  });

  return match || null;
}

/**
 * Handle incoming customer actions for Netflix orders (Code request, Login completed confirmation)
 */
export async function handleNetflixCustomerAction(
  phone: string,
  conversationId: string,
  triggerId: string,
  rawText: string,
  actionType: 'NEED_CODE' | 'LOGIN_DONE',
  preloadedOrder?: Order
): Promise<void> {
  let targetOrderCode = '';
  if (triggerId.includes(':')) {
    targetOrderCode = triggerId.split(':')[1]?.trim();
  }

  let order: Order | null = null;
  if (targetOrderCode) {
    order = await db.getOrderByCode(targetOrderCode);
  }

  if (!order) {
    order = preloadedOrder || (await findActiveNetflixOrder(phone));
  }

  if (!order) {
    if (actionType === 'NEED_CODE') {
      await whatsappService.sendMessage(
        phone,
        '⚠️ আপনার কোনো সক্রিয় Netflix অর্ডার পাওয়া যায়নি। সহায়তার জন্য */human* বা মেনুর জন্য */menu* লিখুন।'
      );
    } else {
      await whatsappService.sendMessage(
        phone,
        '🎉 আপনার মেসেজটি পেয়েছি। DS Dukan-এর সাথে থাকার জন্য ধন্যবাদ! ❤️'
      );
    }
    return;
  }

  const assignedWorkerName = order.current_worker?.full_name || 'Worker';

  if (actionType === 'NEED_CODE') {
    // 1. Update customer notes with NETFLIX_CODE_REQUESTED timestamp
    const updatedNotes = `${order.customer_notes || ''} | NETFLIX_CODE_REQUESTED:${new Date().toLocaleTimeString()}`;
    await db.updateOrderStatus(order.order_id, order.status, { notes: updatedNotes });

    const refreshedOrder = (await db.getOrderByCode(order.order_id)) || order;

    // 2. Notify customer on WhatsApp
    await whatsappService.sendNetflixCodeRequestedAck(phone, order.order_id);

    // 3. Delete previous order card & post new active card with code action buttons as latest message
    if (env.telegram.isConfigured && env.telegram.workerGroupId) {
      const prevMsgId = refreshedOrder.telegram_message_id;
      if (prevMsgId) {
        try {
          await telegramClient.deleteMessage(env.telegram.workerGroupId, prevMsgId);
        } catch (delErr) {
          console.warn('[Netflix Code Req Sync] Failed to delete previous card:', delErr);
          await telegramClient.editMessageReplyMarkup(env.telegram.workerGroupId, prevMsgId, { inline_keyboard: [] }).catch(() => {});
        }
      }

      const { cardHtml, replyMarkup } = generateOrderCard(refreshedOrder, assignedWorkerName);
      const sendRes = await telegramClient.sendMessage(env.telegram.workerGroupId, cardHtml, {
        reply_markup: sanitizeReplyMarkup(replyMarkup)
      });
      if (sendRes.ok && sendRes.result?.message_id) {
        refreshedOrder.telegram_message_id = sendRes.result.message_id;
        await db.updateOrderTelegramMessageId(refreshedOrder.id, sendRes.result.message_id);
      }
    }
  } else if (actionType === 'LOGIN_DONE') {
    // 1. Update customer notes with NETFLIX_LOGIN_DONE
    const updatedNotes = `${order.customer_notes || ''} | NETFLIX_LOGIN_DONE:${new Date().toLocaleTimeString()}`;
    await db.updateOrderStatus(order.order_id, order.status, { notes: updatedNotes });

    const refreshedOrder = (await db.getOrderByCode(order.order_id)) || order;

    // 2. Reply to customer
    await whatsappService.sendMessage(
      phone,
      `🎉 *দারুণ! আপনার Netflix লগইন সফলভাবে সম্পন্ন হয়েছে!*\n\nDS Dukan থেকে সার্ভিস নেওয়ার জন্য অসংখ্য ধন্যবাদ! ❤️ কোনো সমস্যা হলে যেকোনো সময় আমাদের জানাতে পারেন।`
    );

    // 3. Delete previous order card & post completion card as latest message with Order Completed button
    if (env.telegram.isConfigured && env.telegram.workerGroupId) {
      const prevMsgId = refreshedOrder.telegram_message_id;
      if (prevMsgId) {
        try {
          await telegramClient.deleteMessage(env.telegram.workerGroupId, prevMsgId);
        } catch (delErr) {
          console.warn('[Netflix Login Done Sync] Failed to delete previous card:', delErr);
          await telegramClient.editMessageReplyMarkup(env.telegram.workerGroupId, prevMsgId, { inline_keyboard: [] }).catch(() => {});
        }
      }

      const { cardHtml, replyMarkup } = generateOrderCard(refreshedOrder, assignedWorkerName);
      const sendRes = await telegramClient.sendMessage(env.telegram.workerGroupId, cardHtml, {
        reply_markup: sanitizeReplyMarkup(replyMarkup)
      });
      if (sendRes.ok && sendRes.result?.message_id) {
        refreshedOrder.telegram_message_id = sendRes.result.message_id;
        await db.updateOrderTelegramMessageId(refreshedOrder.id, sendRes.result.message_id);
      }
    }
  }
}

/**
 * Check if an order is a Crunchyroll account order
 */
export function isCrunchyrollOrder(order?: { items?: Array<{ product_name?: string }>; customer_notes?: string | null }): boolean {
  if (!order) return false;
  const itemNames = (order.items || []).map(i => i.product_name?.toLowerCase() || '').join(' ');
  const notes = (order.customer_notes || '').toLowerCase();
  return itemNames.includes('crunchyroll') || notes.includes('crunchyroll');
}

/**
 * Find active Crunchyroll order for a customer's phone
 */
export async function findActiveCrunchyrollOrder(phone: string): Promise<Order | null> {
  const cleanPhone = phone.replace(/\D/g, '');
  const activeOrders = await db.getOrders({ limit: 15 });
  
  const match = activeOrders.find(o => {
    const orderPhone = (o.delivery_phone || '').replace(/\D/g, '');
    const isPhoneMatch = orderPhone.includes(cleanPhone) || cleanPhone.includes(orderPhone);
    const isActive = ['PENDING_CLAIM', 'CLAIMED', 'PROCESSING', 'OUT_FOR_DELIVERY'].includes(o.status);
    return isPhoneMatch && isActive && isCrunchyrollOrder(o);
  });

  return match || null;
}

/**
 * Handle incoming customer actions for Crunchyroll orders (Login completed confirmation)
 */
export async function handleCrunchyrollCustomerAction(
  phone: string,
  conversationId: string,
  triggerId: string,
  rawText: string,
  preloadedOrder?: Order
): Promise<void> {
  let targetOrderCode = '';
  if (triggerId.includes(':')) {
    targetOrderCode = triggerId.split(':')[1]?.trim();
  }

  let order: Order | null = null;
  if (targetOrderCode) {
    order = await db.getOrderByCode(targetOrderCode);
  }

  if (!order) {
    order = preloadedOrder || (await findActiveCrunchyrollOrder(phone));
  }

  if (!order) {
    await whatsappService.sendMessage(
      phone,
      '🎉 আপনার মেসেজটি পেয়েছি। DS Dukan-এর সাথে থাকার জন্য ধন্যবাদ! ❤️'
    );
    return;
  }

  const assignedWorkerName = order.current_worker?.full_name || 'Worker';

  // 1. Update customer notes with CRUNCHYROLL_LOGIN_DONE
  const updatedNotes = `${order.customer_notes || ''} | CRUNCHYROLL_LOGIN_DONE:${new Date().toLocaleTimeString()}`;
  await db.updateOrderStatus(order.order_id, order.status, { notes: updatedNotes });

  const refreshedOrder = (await db.getOrderByCode(order.order_id)) || order;

  // 2. Reply to customer
  await whatsappService.sendMessage(
    phone,
    `🎉 *দারুণ! আপনার Crunchyroll লগইন সফলভাবে সম্পন্ন হয়েছে!*\n\nDS Dukan থেকে সার্ভিস নেওয়ার জন্য অসংখ্য ধন্যবাদ! ❤️ কোনো সমস্যা হলে যেকোনো সময় আমাদের জানাতে পারেন।`
  );

  // 3. Delete previous order card & post completion card as latest message with Order Completed button
  if (env.telegram.isConfigured && env.telegram.workerGroupId) {
    const prevMsgId = refreshedOrder.telegram_message_id;
    if (prevMsgId) {
      try {
        await telegramClient.deleteMessage(env.telegram.workerGroupId, prevMsgId);
      } catch (delErr) {
        console.warn('[Crunchyroll Login Done Sync] Failed to delete previous card:', delErr);
        await telegramClient.editMessageReplyMarkup(env.telegram.workerGroupId, prevMsgId, { inline_keyboard: [] }).catch(() => {});
      }
    }

    const { cardHtml, replyMarkup } = generateOrderCard(refreshedOrder, assignedWorkerName);
    const sendRes = await telegramClient.sendMessage(env.telegram.workerGroupId, cardHtml, {
      reply_markup: sanitizeReplyMarkup(replyMarkup)
    });
    if (sendRes.ok && sendRes.result?.message_id) {
      refreshedOrder.telegram_message_id = sendRes.result.message_id;
      await db.updateOrderTelegramMessageId(refreshedOrder.id, sendRes.result.message_id);
    }
  }
}
