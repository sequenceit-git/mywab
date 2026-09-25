import { Order } from '@/types';
import { db } from '../db';
import { env } from '../config/env';
import { whatsappService } from '../whatsapp/service';
import { storageService } from '../storage';
import { telegramClient } from './client';
import {
  generateOrderCard,
  cancellationStore,
  sanitizeReplyMarkup
} from './card-builder';

/**
 * Execute order cancellation with either preset or custom reason
 */
export async function executeOrderCancellation(params: {
  orderIdCode: string;
  cancelReason: string;
  workerTelegramId: number;
  workerName: string;
  workerUsername?: string;
  chatId?: string | number;
  messageId?: number;
}): Promise<{ success: boolean; message: string; order?: Order }> {
  const { orderIdCode, cancelReason, workerTelegramId, workerName, chatId, messageId } = params;

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

  // Workers can only cancel the order after claim, not before the claim
  if (!assignedTelegramId || existingOrder.status === 'PENDING_CLAIM' || existingOrder.status === 'PENDING_PAYMENT') {
    return {
      success: false,
      message: 'অর্ডারটি বাতিল করতে হলে প্রথমে এটি ক্লেইম (Claim) করতে হবে।'
    };
  }

  if (assignedTelegramId !== workerTelegramId) {
    return {
      success: false,
      message: `⛔ এই অর্ডারটি [${assignedWorkerName}] ক্লেইম করেছেন। শুধুমাত্র তিনি অথবা অ্যাডমিন এটি বাতিল করতে পারবেন।`
    };
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
    const { cardHtml, replyMarkup } = generateOrderCard(order, workerName);
    await telegramClient.editMessageText(targetChatId, targetMsgId, cardHtml, replyMarkup);

    // Clean up buttons or message from any previous card for this order if different
    if (order.telegram_message_id && order.telegram_message_id !== targetMsgId) {
      try {
        await telegramClient.deleteMessage(targetChatId, order.telegram_message_id);
      } catch {
        await telegramClient.editMessageReplyMarkup(targetChatId, order.telegram_message_id, { inline_keyboard: [] });
      }
    }
  }

  // Trigger WhatsApp customer notification with custom reason
  whatsappService.sendOrderCancelledNotification(order, cancelReason).catch(err => {
    console.error('[Telegram->WhatsApp Notify Error on Custom Cancel]:', err);
  });

  // Clear pending cancellation state for this worker
  cancellationStore.clearPendingCancellation(workerTelegramId);

  // Trigger queue to dispatch next order in line
  import('./queue').then(m => m.telegramQueue.processNextInQueue()).catch(err => {
    console.warn('[Telegram Queue Auto-Dispatch Warning on Cancel]:', err);
  });

  return { success: true, message: `Order #${orderIdCode} cancelled: ${cancelReason}`, order };
}

/**
 * Handle incoming text messages from workers in the Telegram group
 */
export async function handleWorkerTextMessage(message: {
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

  // Command: /start or /help
  if (text === '/start' || text === '/help') {
    const helpText = 
`👋 <b>WapBusiness Worker Bot Commands</b>

• <b>/stats</b> - আপনার ডেলিভারি পরিসংখ্যান
• <b>/check &lt;order_id&gt;</b> - অর্ডারের বিস্তারিত ও পেমেন্ট স্ট্যাটাস (Auto-Paid or Manual)
• <b>/gateway</b> - ZiniPay অটো-পেমেন্ট গেটওয়ের বর্তমান অবস্থা
• <b>/cancel &lt;order_id&gt; &lt;reason&gt;</b> - ক্লেইমকৃত অর্ডার বাতিল করুন
• <b>/help</b> - কমান্ড সহায়িকা

💡 <i>গ্রাহক ZiniPay দিয়ে পেমেন্ট করলে গ্রুপে সরাসরি 🟢 <b>[AUTO-PAID]</b> অর্ডার আসে। পেমেন্ট ১০০% নিশ্চিত হওয়ায় ম্যানুয়াল SMS চেক করার প্রয়োজন নেই।</i>`;

    await telegramClient.sendMessage(message.chat.id, helpText, { reply_to_message_id: message.message_id });
    return { handled: true, success: true, message: 'Help sent' };
  }

  // Command: /stats
  if (text === '/stats') {
    const workers = await db.getWorkers();
    const worker = workers.find(w => w.telegram_user_id === workerId || (message.from.username && w.telegram_username?.toLowerCase() === message.from.username.toLowerCase()));

    let statsText = '';
    if (worker) {
      statsText = 
`📊 <b>ডেলিভারি পরিসংখ্যান / Worker Stats</b>

👷 <b>কর্মী:</b> <b>${worker.full_name}</b> (@${worker.telegram_username || 'n/a'})
🆔 <b>Telegram ID:</b> <code>${worker.telegram_user_id}</code>
🛡️ <b>ভূমিকা:</b> <code>${worker.role}</code>

⚡ <b>অ্যাক্টিভ ক্লেইম:</b> <b>${worker.active_orders || 0} টি</b>
✅ <b>মোট সম্পন্ন ডেলিভারি:</b> <b>${worker.total_completed_orders || 0} টি</b>

🟢 <i>অর্ডার ক্লেইম করতে নোটিফিকেশন আসলে [⚡ Claim Order] চাপুন।</i>`;
    } else {
      statsText = 
`ℹ️ <b>Worker Profile Status</b>

আপনার Telegram ID (<code>${workerId}</code>) দিয়ে ডাটাবেজে কোনো রেজিস্টার্ড কর্মী প্রোফাইল পাওয়া যায়নি।
গ্রুপে নতুন অর্ডার আসলে <b>[⚡ Claim Order]</b> বাটনে চাপ দিলে আপনার প্রোফাইল স্বয়ংক্রিয়ভাবে সক্রিয় হবে।`;
    }

    await telegramClient.sendMessage(message.chat.id, statsText, { reply_to_message_id: message.message_id });
    return { handled: true, success: true, message: 'Stats sent' };
  }

  // Command: /check <order_id_or_invoice_id> or /order <id>
  const checkCmdMatch = text.match(/^\/(?:check|order)(?:\s+([A-Za-z0-9_-]+))?$/i);
  if (checkCmdMatch) {
    let targetCode = checkCmdMatch[1]?.trim();
    if (!targetCode) {
      const replyOrderMatch = replyText.match(/Order(?:\s*ID)?:\s*([A-Za-z0-9-]+)/i) || replyText.match(/#(WAP-[0-9]+-[0-9]+)/i);
      if (replyOrderMatch) {
        targetCode = replyOrderMatch[1];
      }
    }

    if (!targetCode) {
      await telegramClient.sendMessage(
        message.chat.id,
        `⚠️ অনুগ্রহ করে Order ID বা Invoice ID উল্লেখ করুন।\nউদাহরণ: <code>/check WAP-20260923-0001</code> অথবা <code>/check INV-12345</code>`,
        { reply_to_message_id: message.message_id }
      );
      return { handled: true, success: false, message: 'Order ID required' };
    }

    const order = (await db.getOrderByCode(targetCode)) || (await db.getOrderByInvoiceId(targetCode));
    if (!order) {
      await telegramClient.sendMessage(
        message.chat.id,
        `❌ <code>${targetCode}</code> দিয়ে কোনো অর্ডার পাওয়া যায়নি। অনুগ্রহ করে সঠিক আইডি চেক করুন।`,
        { reply_to_message_id: message.message_id }
      );
      return { handled: true, success: false, message: 'Order not found' };
    }

    const firstItem = order.items?.[0];
    const gameTitle = order.customer_notes?.match(/Game:\s*([^|\n]+)/i)?.[1]?.trim() || firstItem?.product_name || 'Top-Up Service';
    const playerUid = order.player_uid || (order.delivery_address as any)?.player_uid || (order.delivery_address as any)?.name || 'N/A';
    const isAuto = Boolean(order.invoice_id || order.payment_method?.toUpperCase().includes('ZINIPAY') || order.trx_id?.startsWith('ZINI'));

    const checkReply = 
`🔍 <b>Order Status / অর্ডার বিবরণ</b>

📦 <b>Order ID:</b> <code>${order.order_id}</code>
🕹️ <b>সার্ভিস:</b> <b>${gameTitle}</b>
🆔 <b>Player UID:</b> <code>${playerUid}</code>
💰 <b>মূল্য:</b> ৳${order.total_amount}

🚦 <b>স্ট্যাটাস:</b> <b>${order.status}</b>
💳 <b>পেমেন্ট মাধ্যম:</b> <b>${order.payment_method || 'bKash/Nagad'}</b>
🧾 <b>Invoice ID:</b> <code>${order.invoice_id || 'N/A'}</code>
🔢 <b>TrxID:</b> <code>${order.trx_id || 'N/A'}</code>
⚡ <b>পেমেন্ট টাইপ:</b> ${isAuto ? '🟢 <b>100% Auto-Verified (ZiniPay)</b>' : '🟡 <b>Manual TrxID</b>'}
👷 <b>অ্যাসাইন কর্মী:</b> <b>${order.current_worker?.full_name || 'অ্যাসাইন হয়নি'}</b>
🕒 <b>অর্ডারের তারিখ:</b> ${new Date(order.created_at).toLocaleString()}`;

    await telegramClient.sendMessage(message.chat.id, checkReply, { reply_to_message_id: message.message_id });
    return { handled: true, success: true, message: 'Order checked' };
  }

  // Command: /gateway or /zinipay
  if (text === '/gateway' || text === '/zinipay') {
    const isAuto = await db.isZiniPayAutoPaymentEnabled();
    const maskedKey = env.zinipay.apiKey ? `${env.zinipay.apiKey.slice(0, 6)}...${env.zinipay.apiKey.slice(-4)}` : 'Not configured';

    const gatewayReply = 
`💳 <b>ZiniPay Payment Gateway Status</b>

⚙️ <b>Auto-Payment Gateway:</b> ${isAuto ? '🟢 <b>ACTIVE (স্বয়ংক্রিয় পেমেন্ট চালু)</b>' : '🟡 <b>INACTIVE (ম্যানুয়াল মোড)</b>'}
🌐 <b>API URL:</b> <code>${env.zinipay.apiUrl}</code>
🔑 <b>API Key:</b> <code>${maskedKey}</code>

ℹ️ <i>গ্রাহকরা চেকআউট লিংক পেলে পেমেন্ট সম্পন্ন হওয়ামাত্রই টেলিগ্রাম ওয়ার্কার গ্রুপে 🟢 <b>[AUTO-PAID]</b> হিসেবে নোটিফিকেশন চলে আসে।</i>`;

    await telegramClient.sendMessage(message.chat.id, gatewayReply, { reply_to_message_id: message.message_id });
    return { handled: true, success: true, message: 'Gateway status sent' };
  }

  // 1. Check for command /cancel [order_id] [reason]
  const cancelCmdMatch = text.match(/^\/cancel(?:\s+([A-Za-z0-9-]+))?(?:\s+(.+))?$/i);
  if (cancelCmdMatch) {
    let targetOrderCode = cancelCmdMatch[1]?.trim();
    let cmdReason = cancelCmdMatch[2]?.trim();

    // If user replied to an order message with "/cancel <reason>"
    if (!targetOrderCode || targetOrderCode.length < 5 || !targetOrderCode.toUpperCase().startsWith('WAP-')) {
      const replyOrderMatch = replyText.match(/Order(?:\s*ID)?:\s*([A-Za-z0-9-]+)/i) || replyText.match(/#(WAP-[0-9]+-[0-9]+)/i);
      if (replyOrderMatch) {
        cmdReason = [targetOrderCode, cmdReason].filter(Boolean).join(' ');
        targetOrderCode = replyOrderMatch[1];
      }
    }

    // Check if user has an active pending cancellation
    const pending = cancellationStore.getPendingCancellation(workerId);
    if (!targetOrderCode && pending) {
      targetOrderCode = pending.orderIdCode;
      cmdReason = [cancelCmdMatch[1], cancelCmdMatch[2]].filter(Boolean).join(' ');
    }

    // If worker just typed "/cancel" without any reason
    if (!cmdReason && pending) {
      cancellationStore.clearPendingCancellation(workerId);
      await telegramClient.sendMessage(message.chat.id, `✅ <b>[${workerName}]</b>, #${pending.orderIdCode} অর্ডার বাতিলের প্রক্রিয়া প্রত্যাহার করা হয়েছে।`);
      return { handled: true, success: true, message: 'Cancellation aborted' };
    }

    if (targetOrderCode && cmdReason) {
      const result = await executeOrderCancellation({
        orderIdCode: targetOrderCode,
        cancelReason: cmdReason,
        workerTelegramId: workerId,
        workerName,
        workerUsername: message.from.username,
        chatId: message.chat.id,
        messageId: pending?.messageId
      });

      if (result.success) {
        await telegramClient.sendMessage(
          message.chat.id,
          `❌ <b>অর্ডার #${targetOrderCode} বাতিল করা হয়েছে</b>\n\n⚠️ <b>কারণ:</b> ${cmdReason}\n👷 <b>কর্মী:</b> <b>${workerName}</b>\n\n<i>কাস্টমারকে হোয়াটসঅ্যাপে বাতিলের কারণ জানানো হয়েছে।</i>`,
          { reply_to_message_id: message.message_id }
        );
      } else {
        await telegramClient.sendMessage(
          message.chat.id,
          `⚠️ অর্ডার #${targetOrderCode} বাতিল করা যায়নি: ${result.message}`,
          { reply_to_message_id: message.message_id }
        );
      }
      return { handled: true, ...result };
    }
  }

  // 2. Check for active pending cancellation session
  const pending = cancellationStore.getPendingCancellation(workerId);
  if (pending) {
    const cancelReason = text;

    const result = await executeOrderCancellation({
      orderIdCode: pending.orderIdCode,
      cancelReason,
      workerTelegramId: workerId,
      workerName,
      workerUsername: message.from.username,
      chatId: message.chat.id,
      messageId: pending.messageId
    });

    if (result.success) {
      await telegramClient.sendMessage(
        message.chat.id,
        `❌ <b>অর্ডার #${pending.orderIdCode} বাতিল করা হয়েছে</b>\n\n⚠️ <b>কারণ:</b> ${cancelReason}\n👷 <b>কর্মী:</b> <b>${workerName}</b>\n\n<i>কাস্টমারকে হোয়াটসঅ্যাপে বাতিলের কারণ পাঠানো হয়েছে।</i>`,
        { reply_to_message_id: message.message_id }
      );
    } else {
      await telegramClient.sendMessage(
        message.chat.id,
        `⚠️ অর্ডার #${pending.orderIdCode} বাতিল করা যায়নি: ${result.message}`,
        { reply_to_message_id: message.message_id }
      );
    }

    return { handled: true, ...result };
  }

  // 3. Check if message is a direct reply to an order card prompt asking for cancellation reason
  const replyOrderMatch = replyText.match(/Order(?:\s*ID)?:\s*([A-Za-z0-9-]+)/i) || replyText.match(/#(WAP-[0-9]+-[0-9]+)/i);
  if (replyOrderMatch && (replyText.includes('WRITE CANCELLATION REASON') || replyText.includes('বাতিলের কারণ লিখুন'))) {
    const orderIdCode = replyOrderMatch[1];
    const cancelReason = text;

    const result = await executeOrderCancellation({
      orderIdCode,
      cancelReason,
      workerTelegramId: workerId,
      workerName,
      workerUsername: message.from.username,
      chatId: message.chat.id,
      messageId: message.reply_to_message?.message_id
    });

    if (result.success) {
      await telegramClient.sendMessage(
        message.chat.id,
        `❌ <b>অর্ডার #${orderIdCode} বাতিল করা হয়েছে</b>\n\n⚠️ <b>কারণ:</b> ${cancelReason}\n👷 <b>কর্মী:</b> <b>${workerName}</b>`,
        { reply_to_message_id: message.message_id }
      );
    } else {
      await telegramClient.sendMessage(
        message.chat.id,
        `⚠️ অর্ডার বাতিল করা যায়নি: ${result.message}`,
        { reply_to_message_id: message.message_id }
      );
    }

    return { handled: true, ...result };
  }

  // 4. Check if message is a reply to a Netflix order card (sending credentials or verification code)
  if (replyOrderMatch) {
    const orderIdCode = replyOrderMatch[1];
    const order = await db.getOrderByCode(orderIdCode);

    if (order) {
      const combinedGameStr = `${order.customer_notes || ''} ${order.items?.map(i => i.product_name).join(' ') || ''}`.toLowerCase();
      const isNetflix = combinedGameStr.includes('netflix');

      const netflixNotes = order.customer_notes || '';
      const netflixWorkerActive =
        order.status === 'CLAIMED' ||
        order.status === 'PROCESSING' ||
        (order.status === 'PENDING_CLAIM' && netflixNotes.includes('NETFLIX_CREDS_SENT'));

      if (isNetflix && netflixWorkerActive) {
        // 4a. Check if worker provided Netflix Account Credentials (Email + Password + PIN)
        const emailMatch = text.match(/(?:email|mail|ইমেইল|user|username)?\s*[:=–-]?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
        const passMatch = text.match(/(?:password|pass|পাসওয়ার্ড|pwd)\s*[:=–-]?\s*([^\n\r]+)/i);
        const pinMatch = text.match(/(?:pin|পিন|profile pin)\s*[:=–-]?\s*([0-9]{4,6})/i);

        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        let credEmail = emailMatch ? emailMatch[1].trim() : '';
        let credPass = passMatch ? passMatch[1].trim() : '';
        let credPin = pinMatch ? pinMatch[1].trim() : '';

        // Multiline fallback without explicit labels (Line 1: Email, Line 2: Pass, Line 3: Pin)
        if (!credEmail && lines.length >= 2 && lines[0].includes('@')) {
          credEmail = lines[0];
          credPass = lines[1].replace(/^(?:password|pass|পাসওয়ার্ড|pwd)[:=–-]?\s*/i, '').trim();
          if (lines[2] && /^[0-9]{4,6}$/.test(lines[2])) {
            credPin = lines[2];
          }
        } else if (credEmail && !credPass && lines.length >= 2) {
          const secondLine = lines.find(l => l !== credEmail && !l.toLowerCase().startsWith('pin') && !l.toLowerCase().startsWith('email'));
          if (secondLine) credPass = secondLine.replace(/^(?:password|pass|পাসওয়ার্ড|pwd)[:=–-]?\s*/i, '').trim();
        }

        if (credEmail && credPass) {
          // Send credentials to customer WhatsApp
          await whatsappService.sendNetflixAccountInfo(
            order.delivery_phone,
            order.order_id,
            credEmail,
            credPass,
            credPin || undefined
          );

          const updatedNotes = `${order.customer_notes || ''} | NETFLIX_CREDS_SENT | Email: ${credEmail} | Pass: ${credPass}${credPin ? ` | PIN: ${credPin}` : ''}`;
          await db.updateOrderStatus(order.order_id, order.status, { notes: updatedNotes });

          const refreshedOrder = (await db.getOrderByCode(order.order_id)) || order;
          const assignedWorkerName = refreshedOrder.current_worker?.full_name || workerName;

          // Delete previous order card to keep group clean and avoid duplicate disjointed messages
          const prevMsgId = order.telegram_message_id || message.reply_to_message?.message_id;
          const targetChatId = message.chat.id || env.telegram.workerGroupId;
          if (prevMsgId && targetChatId) {
            try {
              await telegramClient.deleteMessage(targetChatId, prevMsgId);
            } catch (delErr) {
              console.warn('[Telegram Netflix Creds Sync] Could not delete old order card:', delErr);
              await telegramClient.editMessageReplyMarkup(targetChatId, prevMsgId, { inline_keyboard: [] }).catch(() => {});
            }
          }

          // Post updated active order card directly below worker's reply with all action buttons
          const { cardHtml, replyMarkup } = generateOrderCard(refreshedOrder, assignedWorkerName);
          const sendRes = await telegramClient.sendMessage(
            targetChatId,
            cardHtml,
            {
              reply_to_message_id: message.message_id,
              reply_markup: sanitizeReplyMarkup(replyMarkup)
            }
          );

          if (sendRes.ok && sendRes.result?.message_id) {
            refreshedOrder.telegram_message_id = sendRes.result.message_id;
            await db.updateOrderTelegramMessageId(refreshedOrder.id, sendRes.result.message_id);
          }

          return { handled: true, success: true, message: 'Netflix credentials sent' };
        }

        // 4b. Check if worker provided Netflix Verification / Household Code (e.g. 4-8 digits)
        const codeOnlyMatch = text.match(/(?:code|কোড|otp|netflix code)?\s*[:=–-]?\s*([0-9]{4,8})/i) || text.match(/^([0-9]{4,8})$/);
        if (codeOnlyMatch) {
          const netflixCode = codeOnlyMatch[1].trim();

          await whatsappService.sendNetflixVerificationCode(
            order.delivery_phone,
            order.order_id,
            netflixCode
          );

          const updatedNotes = `${order.customer_notes || ''} | NETFLIX_CODE_SENT:${netflixCode}`;
          await db.updateOrderStatus(order.order_id, order.status, { notes: updatedNotes });

          const refreshedOrder = (await db.getOrderByCode(order.order_id)) || order;
          const assignedWorkerName = refreshedOrder.current_worker?.full_name || workerName;

          // Delete previous order card message
          const prevMsgId = order.telegram_message_id || message.reply_to_message?.message_id;
          const targetChatId = message.chat.id || env.telegram.workerGroupId;
          if (prevMsgId && targetChatId) {
            try {
              await telegramClient.deleteMessage(targetChatId, prevMsgId);
            } catch (delErr) {
              console.warn('[Telegram Netflix Code Sync] Could not delete old order card:', delErr);
              await telegramClient.editMessageReplyMarkup(targetChatId, prevMsgId, { inline_keyboard: [] }).catch(() => {});
            }
          }

          // Post updated active order card directly below worker's reply
          const { cardHtml, replyMarkup } = generateOrderCard(refreshedOrder, assignedWorkerName);
          const sendRes = await telegramClient.sendMessage(
            targetChatId,
            cardHtml,
            {
              reply_to_message_id: message.message_id,
              reply_markup: sanitizeReplyMarkup(replyMarkup)
            }
          );

          if (sendRes.ok && sendRes.result?.message_id) {
            refreshedOrder.telegram_message_id = sendRes.result.message_id;
            await db.updateOrderTelegramMessageId(refreshedOrder.id, sendRes.result.message_id);
          }

          return { handled: true, success: true, message: 'Netflix code sent' };
        }
      }

      // 4c. Check if worker provided Crunchyroll Account Credentials (Email + Password)
      const isCrunchyroll = combinedGameStr.includes('crunchyroll');

      const crunchyNotes = order.customer_notes || '';
      const crunchyWorkerActive =
        order.status === 'CLAIMED' ||
        order.status === 'PROCESSING' ||
        (order.status === 'PENDING_CLAIM' && crunchyNotes.includes('CRUNCHYROLL_CREDS_SENT'));

      if (isCrunchyroll && crunchyWorkerActive) {
        const emailMatch = text.match(/(?:email|mail|ইমেইল|user|username)?\s*[:=–-]?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
        const passMatch = text.match(/(?:password|pass|পাসওয়ার্ড|pwd)\s*[:=–-]?\s*([^\n\r]+)/i);

        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        let credEmail = emailMatch ? emailMatch[1].trim() : '';
        let credPass = passMatch ? passMatch[1].trim() : '';

        // Multiline fallback (Line 1: Email, Line 2: Pass)
        if (!credEmail && lines.length >= 2 && lines[0].includes('@')) {
          credEmail = lines[0];
          credPass = lines[1].replace(/^(?:password|pass|পাসওয়ার্ড|pwd)[:=–-]?\s*/i, '').trim();
        } else if (credEmail && !credPass && lines.length >= 2) {
          const secondLine = lines.find(l => l !== credEmail && !l.toLowerCase().startsWith('email'));
          if (secondLine) credPass = secondLine.replace(/^(?:password|pass|পাসওয়ার্ড|pwd)[:=–-]?\s*/i, '').trim();
        }

        if (credEmail && credPass) {
          await whatsappService.sendCrunchyrollAccountInfo(
            order.delivery_phone,
            order.order_id,
            credEmail,
            credPass
          );

          const updatedNotes = `${order.customer_notes || ''} | CRUNCHYROLL_CREDS_SENT | Email: ${credEmail} | Pass: ${credPass}`;
          await db.updateOrderStatus(order.order_id, order.status, { notes: updatedNotes });

          const refreshedOrder = (await db.getOrderByCode(order.order_id)) || order;
          const assignedWorkerName = refreshedOrder.current_worker?.full_name || workerName;

          // Delete previous order card message
          const prevMsgId = order.telegram_message_id || message.reply_to_message?.message_id;
          const targetChatId = message.chat.id || env.telegram.workerGroupId;
          if (prevMsgId && targetChatId) {
            try {
              await telegramClient.deleteMessage(targetChatId, prevMsgId);
            } catch (delErr) {
              console.warn('[Telegram Crunchyroll Creds Sync] Could not delete old order card:', delErr);
              await telegramClient.editMessageReplyMarkup(targetChatId, prevMsgId, { inline_keyboard: [] }).catch(() => {});
            }
          }

          // Post updated active order card directly below worker's reply
          const { cardHtml, replyMarkup } = generateOrderCard(refreshedOrder, assignedWorkerName);
          const sendRes = await telegramClient.sendMessage(
            targetChatId,
            cardHtml,
            {
              reply_to_message_id: message.message_id,
              reply_markup: sanitizeReplyMarkup(replyMarkup)
            }
          );

          if (sendRes.ok && sendRes.result?.message_id) {
            refreshedOrder.telegram_message_id = sendRes.result.message_id;
            await db.updateOrderTelegramMessageId(refreshedOrder.id, sendRes.result.message_id);
          }

          return { handled: true, success: true, message: 'Crunchyroll credentials sent' };
        }
      }
    }
  }

  return { handled: false };
}

/**
 * Handle incoming photo from worker in Telegram (QR Code for PUBG QR Login orders)
 */
export async function handleWorkerPhotoMessage(message: {
  message_id: number;
  chat: { id: number | string };
  from: { id: number; first_name: string; last_name?: string; username?: string };
  photo?: Array<{ file_id: string; file_unique_id: string; width: number; height: number; file_size?: number }>;
  caption?: string;
  reply_to_message?: { message_id: number; text?: string; caption?: string };
}): Promise<{ handled: boolean; success?: boolean; message?: string }> {
  if (!message.photo || message.photo.length === 0) {
    return { handled: false };
  }

  const workerId = message.from.id;
  const workerName = [message.from.first_name, message.from.last_name].filter(Boolean).join(' ') || message.from.username || `Worker-${workerId}`;
  const caption = (message.caption || '').trim();
  const replyText = message.reply_to_message?.text || message.reply_to_message?.caption || '';

  console.log(`[Telegram Photo] Received photo from worker "${workerName}" (${workerId}). Checking for target QR order...`);

  // 1. Identify targeted order
  let targetOrderCode = '';

  // 1a. Check reply text
  const replyMatch = replyText.match(/Order(?:\s*ID)?:\s*([A-Za-z0-9-]+)/i) || replyText.match(/#(WAP-[0-9]+-[0-9]+|DS-[0-9]+|[A-Za-z0-9-]+)/i);
  if (replyMatch) {
    targetOrderCode = replyMatch[1].replace('#', '');
  }

  // 1b. Check caption (e.g. "#DS-1024" or "DS-1024")
  if (!targetOrderCode && caption) {
    const captionMatch = caption.match(/(?:#)?([A-Za-z0-9-]+)/);
    if (captionMatch) {
      targetOrderCode = captionMatch[1];
    }
  }

  let targetOrder: Order | null = null;
  if (targetOrderCode) {
    targetOrder = await db.getOrderByCode(targetOrderCode);
  }

  // 1c. If no specific order code found, look for active claimed QR order for this worker
  if (!targetOrder) {
    const activeOrders = await db.getOrders({
      status: 'CLAIMED'
    });
    const workerQrOrder = activeOrders.find(o => {
      const isWorkerMatch = o.current_worker?.telegram_user_id === workerId;
      const isQr = (o.customer_notes || '').toLowerCase().includes('pubg_login') ||
                   (o.customer_notes || '').toLowerCase().includes('qr') ||
                   o.items?.some(i => i.product_name.toLowerCase().includes('qr'));
      return isWorkerMatch && isQr;
    });

    if (workerQrOrder) {
      targetOrder = workerQrOrder;
    }
  }

  if (!targetOrder) {
    console.log(`[Telegram Photo] No active QR order matched for worker ${workerName}`);
    return { handled: false };
  }

  // 2. Fetch the highest resolution photo file path from Telegram Bot API
  const bestPhoto = message.photo[message.photo.length - 1];
  const fileId = bestPhoto.file_id;

  try {
    const fileRes = await fetch(`${env.telegram.apiUrl}/getFile?file_id=${fileId}`);
    const fileData = await fileRes.json();

    if (!fileData.ok || !fileData.result?.file_path) {
      await telegramClient.sendMessage(
        message.chat.id,
        `⚠️ Telegram থেকে ছবি লোড করা যায়নি: ${fileData.description || 'Unknown error'}`,
        { reply_to_message_id: message.message_id }
      );
      return { handled: true, success: false, message: 'Failed to get file from Telegram' };
    }

    const telegramPhotoUrl = `https://api.telegram.org/file/bot${env.telegram.botToken}/${fileData.result.file_path}`;
    console.log(`[Telegram Photo] Photo URL resolved for Order #${targetOrder.order_id}: ${telegramPhotoUrl}`);

    // 3. Download image buffer and save to local storage
    let finalImageUrl = telegramPhotoUrl;
    try {
      const photoFetch = await fetch(telegramPhotoUrl);
      if (photoFetch.ok) {
        const buffer = await photoFetch.arrayBuffer();
        const uploadRes = await storageService.uploadImage(
          buffer,
          `qr_${targetOrder.order_id}.jpg`,
          'pubg-qr',
          'image/jpeg'
        );
        if (uploadRes.success && uploadRes.publicUrl) {
          finalImageUrl = uploadRes.publicUrl;
          console.log(`[Telegram Photo] Stored in Media Storage: ${finalImageUrl}`);
        }
      }
    } catch (storageErr) {
      console.warn('[Telegram Photo Storage Upload Warning]:', storageErr);
    }

    // 4. Send QR Code to customer on WhatsApp with interactive buttons
    const firstItem = targetOrder.items?.[0];
    const sendResult = await whatsappService.sendQrCodePrompt(
      targetOrder.delivery_phone,
      finalImageUrl,
      targetOrder.order_id,
      firstItem?.product_name
    );

    if (!sendResult.success) {
      await telegramClient.sendMessage(
        message.chat.id,
        `⚠️ কাস্টমারের WhatsApp-এ QR কোড পাঠানো যায়নি: ${sendResult.error || 'Network error'}`,
        { reply_to_message_id: message.message_id }
      );
      return { handled: true, success: false, message: sendResult.error };
    }

    // 5. Update order notes & status to PROCESSING
    const updatedNotes = `QR Code forwarded to WhatsApp at ${new Date().toLocaleTimeString()} (5m expiry timer) | Storage: ${finalImageUrl}`;
    targetOrder.status = 'PROCESSING';
    targetOrder.customer_notes = `${targetOrder.customer_notes || ''} | ${updatedNotes}`;
    await db.updateOrderStatus(targetOrder.order_id, 'PROCESSING', {
      notes: updatedNotes
    });

    // 5b. Remove the previous order card message above the screenshot so group stays clean
    const oldMessageId = targetOrder.telegram_message_id;
    if (oldMessageId) {
      const targetChatId = message.chat.id || env.telegram.workerGroupId;
      try {
        await telegramClient.deleteMessage(targetChatId, oldMessageId);
        console.log(`[Telegram Photo] Cleaned up previous order card message #${oldMessageId} for Order #${targetOrder.order_id}`);
      } catch (delErr) {
        console.warn('[Telegram Photo] Could not delete old order card:', delErr);
      }
      await telegramClient.editMessageReplyMarkup(targetChatId, oldMessageId, { inline_keyboard: [] }).catch(() => {});
    }

    // 6. Post the new active order card directly below the worker's screenshot with the action buttons
    const { cardHtml, replyMarkup } = generateOrderCard(targetOrder, workerName);
    const postCardText = 
`✅ <b>QR কোড কাস্টমারের WhatsApp-এ সফলভাবে পাঠানো হয়েছে!</b>

${cardHtml}`;

    const sendRes = await telegramClient.sendMessage(
      message.chat.id,
      postCardText,
      {
        reply_to_message_id: message.message_id,
        reply_markup: replyMarkup
      }
    );

    if (sendRes.ok && sendRes.result?.message_id) {
      targetOrder.telegram_message_id = sendRes.result.message_id;
      await db.updateOrderTelegramMessageId(targetOrder.id, sendRes.result.message_id);
    }

    return { handled: true, success: true };
  } catch (err) {
    console.error('[Telegram handleWorkerPhotoMessage Exception]:', err);
    await telegramClient.sendMessage(
      message.chat.id,
      `⚠️ QR কোড প্রসেস করতে ত্রুটি: ${String(err)}`,
      { reply_to_message_id: message.message_id }
    );
    return { handled: true, success: false, message: String(err) };
  }
}
