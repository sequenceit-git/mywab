import { db } from '../../db';
import { whatsappService } from '../../whatsapp/service';
import { telegramClient } from '../../telegram/client';
import { generateOrderCard } from '../../telegram/card-builder';
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
  const assignedWorkerTgId = order.current_worker?.telegram_user_id;

  if (actionType === 'NEED_CODE') {
    // 1. Update customer notes with NETFLIX_CODE_REQUESTED timestamp
    const updatedNotes = `${order.customer_notes || ''} | NETFLIX_CODE_REQUESTED:${new Date().toLocaleTimeString()}`;
    await db.updateOrderStatus(order.order_id, order.status, { notes: updatedNotes });

    const refreshedOrder = (await db.getOrderByCode(order.order_id)) || order;

    // 2. Notify customer on WhatsApp
    await whatsappService.sendNetflixCodeRequestedAck(phone, order.order_id);

    // 3. Update main Telegram order card
    if (env.telegram.isConfigured && refreshedOrder.telegram_message_id && env.telegram.workerGroupId) {
      try {
        const { cardHtml, replyMarkup } = generateOrderCard(refreshedOrder, assignedWorkerName);
        await telegramClient.editMessageText(env.telegram.workerGroupId, refreshedOrder.telegram_message_id, cardHtml, replyMarkup);
      } catch (editErr) {
        console.warn('[Netflix Code Req Card Edit Error]:', editErr);
      }

      // 4. Send high-priority alert notification in Telegram group
      const workerTag = assignedWorkerTgId ? `<a href="tg://user?id=${assignedWorkerTgId}">@${assignedWorkerName}</a>` : `<b>${assignedWorkerName}</b>`;
      const alertText = 
`🔔 <b>[NETFLIX CODE REQUESTED / কাস্টমার কোড চেয়েছেন!]</b>

📦 <b>Order ID:</b> <code>${refreshedOrder.order_id}</code>
🍿 <b>Service:</b> <b>Netflix Account</b>
👷 <b>Assigned Worker:</b> ${workerTag}
📞 <b>Customer:</b> <code>${refreshedOrder.delivery_phone}</code>

👉 <b>অ্যাকশন:</b> কাস্টমারকে কোড পাঠাতে এই মেসেজে রিপ্লাই করে কোডটি লিখুন (যেমন: <code>482910</code>) অথবা নিচে <b>[📤 Send Code to Customer]</b> চাপুন।`;

      try {
        await telegramClient.sendMessage(env.telegram.workerGroupId, alertText, {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '📤 Send Code to Customer', callback_data: `netflix_code_hint:${refreshedOrder.order_id}` }
              ]
            ]
          }
        });
      } catch (tgErr) {
        console.error('[Netflix Code Req TG Alert Error]:', tgErr);
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

    // 3. Update main Telegram order card & send alert to complete
    if (env.telegram.isConfigured && refreshedOrder.telegram_message_id && env.telegram.workerGroupId) {
      try {
        const { cardHtml, replyMarkup } = generateOrderCard(refreshedOrder, assignedWorkerName);
        await telegramClient.editMessageText(env.telegram.workerGroupId, refreshedOrder.telegram_message_id, cardHtml, replyMarkup);
      } catch (editErr) {
        console.warn('[Netflix Login Done Card Edit Error]:', editErr);
      }

      const alertText = 
`🎉 <b>[CUSTOMER CONFIRMED NETFLIX LOGIN!]</b>

📦 <b>Order ID:</b> <code>${refreshedOrder.order_id}</code>
🍿 <b>Service:</b> <b>Netflix Account</b>
👷 <b>Assigned Worker:</b> <b>${assignedWorkerName}</b>

✅ <b>গ্রাহক সফলভাবে Netflix-এ লগইন সম্পন্ন করেছেন।</b>
👉 এখন কার্ডের <b>"✅ Order Completed (ডেলিভারি সম্পন্ন)"</b> বাটনে চাপ দিন।`;

      try {
        await telegramClient.sendMessage(env.telegram.workerGroupId, alertText, {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Order Completed (ডেলিভারি সম্পন্ন)', callback_data: `status_delivered:${refreshedOrder.order_id}` }
              ]
            ]
          }
        });
      } catch (tgErr) {
        console.error('[Netflix Login Done TG Alert Error]:', tgErr);
      }
    }
  }
}
