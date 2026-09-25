import { db } from '../db';
import { whatsappService } from '../whatsapp/service';
import { getAccountFieldInfo } from '../chat/input-parser';
import { telegramClient } from './client';
import {
  generateOrderCard,
  resolveCancelReason,
  cancellationStore,
  isQrLoginOrder,
  hasQrCodeBeenSent
} from './card-builder';
import { executeOrderCancellation } from './message-handlers';

export async function handleCallbackQuery(callbackQuery: {
  id: string;
  from: { id: number; first_name: string; last_name?: string; username?: string };
  message?: { message_id: number; chat: { id: number | string } };
  data?: string;
}): Promise<{ success: boolean; message: string; alertText?: string }> {
  const { id, from, message, data } = callbackQuery;
  if (!data) {
    await telegramClient.answerCallbackQuery(id, '⚠️ Invalid action', true);
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
    await telegramClient.answerCallbackQuery(id, '⚠️ Order not found in database', true);
    return { success: false, message: 'Order not found' };
  }

  if (existingOrder.status === 'CANCELLED') {
    await telegramClient.answerCallbackQuery(
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

  // QR Interactive Hints
  if (action === 'qr_hint') {
    const qrAlreadySent = hasQrCodeBeenSent(existingOrder);

    // If the screenshot has already been dropped/sent, suppress the modal completely!
    if (qrAlreadySent) {
      await telegramClient.answerCallbackQuery(
        id,
        '✅ QR কোড ইতোমধ্যে পাঠানো হয়েছে! কাস্টমার স্ক্যান করার অপেক্ষায় রয়েছে।',
        false
      );
      return { success: true, message: 'QR already sent, hint suppressed' };
    }

    // Only show popup modal if worker has NOT provided the image yet and clicks send screenshot button
    await telegramClient.answerCallbackQuery(
      id,
      '📸 অনুগ্রহ করে এই মেসেজে রিপ্লাই করে লগইন QR কোডের ছবি/স্ক্রিনশট পাঠান। বট সাথে সাথে কাস্টমারের WhatsApp-এ পাঠিয়ে দেবে।',
      true
    );
    return { success: true, message: 'QR hint shown' };
  }

  if (action === 'qr_waiting') {
    await telegramClient.answerCallbackQuery(
      id,
      '⏳ কাস্টমারের WhatsApp-এ QR কোড পাঠানো হয়েছে (৫ মিনিট মেয়াদ)। কাস্টমার স্ক্যান করলে আপনাকে সাথে সাথে এখানে নোটিফাই করা হবে।',
      false
    );
    return { success: true, message: 'QR waiting info shown' };
  }

  if (action === 'qr_resend_hint') {
    await telegramClient.answerCallbackQuery(
      id,
      '📸 অনুগ্রহ করে এই মেসেজে রিপ্লাই করে নতুন লগইন QR কোডের ছবি/স্ক্রিনশট পাঠান। বট সাথে সাথে কাস্টমারের WhatsApp-এ পাঠিয়ে দেবে (৫ মিনিট মেয়াদ)।',
      true
    );
    return { success: true, message: 'QR resend hint shown' };
  }

  // Netflix Action: Show Credential Input Hint
  if (action === 'netflix_creds_hint') {
    await telegramClient.answerCallbackQuery(
      id,
      '🔑 এই মেসেজে রিপ্লাই করে Netflix Email, Password এবং PIN (যদি থাকে) পাঠান। যেমন:\nuser@netflix.com\npass123\n1234',
      true
    );
    return { success: true, message: 'Netflix credentials hint shown' };
  }

  // Netflix Action: Show Code Input Hint
  if (action === 'netflix_code_hint') {
    await telegramClient.answerCallbackQuery(
      id,
      '📤 এই মেসেজে রিপ্লাই করে Netflix Verification Code টি লিখে পাঠান (যেমন: 482910)।',
      true
    );
    return { success: true, message: 'Netflix code hint shown' };
  }

  // Crunchyroll Action: Show Credential Input Hint
  if (action === 'crunchyroll_creds_hint') {
    await telegramClient.answerCallbackQuery(
      id,
      '🔑 এই মেসেজে রিপ্লাই করে Crunchyroll Email ও Password পাঠান। যেমন:\nuser@crunchyroll.com\npass123',
      true
    );
    return { success: true, message: 'Crunchyroll credentials hint shown' };
  }

  // Email Verification "Code Method" action (PUBG KR / eFootball) — worker requests/re-requests code
  if (action === 'code_request') {
    // Must be claimed first
    if (!assignedTelegramId || existingOrder.status === 'PENDING_CLAIM' || existingOrder.status === 'PENDING_PAYMENT') {
      await telegramClient.answerCallbackQuery(id, `⚠️ প্রথমে 'Claim Order' বাটনে ক্লিক করে অর্ডারটি গ্রহণ করুন!`, true);
      return { success: false, message: 'Order must be claimed first' };
    }

    // Check worker lock
    if (assignedTelegramId !== from.id) {
      await telegramClient.answerCallbackQuery(
        id,
        `⛔ একশন বাতিল!\nএই অর্ডারটি [${assignedWorkerName}] ক্লেইম করেছেন। শুধুমাত্র তিনি অথবা অ্যাডমিন প্যানেল এতে একশন নিতে পারবেন।`,
        true
      );
      return { success: false, message: `Unauthorized: Claimed by ${assignedWorkerName}` };
    }

    const isResend = (existingOrder.customer_notes || '').includes('CODE_REQUESTED');

    try {
      const productName = existingOrder.items?.[0]?.product_name || '';
      const sendResult = await whatsappService.sendVerificationCodeRequest(existingOrder.delivery_phone, existingOrder.order_id, isResend, productName);
      if (!sendResult.success) {
        await telegramClient.answerCallbackQuery(id, `⚠️ কাস্টমারকে নোটিফাই করা যায়নি: ${sendResult.error || 'Unknown error'}`, true);
        return { success: false, message: sendResult.error || 'Failed to notify customer' };
      }

      // Put the customer's WhatsApp session into AWAITING_VERIFICATION_CODE mode so the next text they send is captured as the code
      try {
        const conversation = await db.getOrCreateConversation(existingOrder.delivery_phone);
        const currentSession = db.getSessionState(conversation.id);
        db.setSessionState(conversation.id, {
          step: 'AWAITING_VERIFICATION_CODE',
          draftOrder: { ...currentSession.draftOrder, pendingOrderId: existingOrder.order_id }
        });
      } catch (convErr) {
        console.error('[Telegram code_request] Failed to set customer session state:', convErr);
      }

      const updatedNotes = `${existingOrder.customer_notes || ''} | CODE_REQUESTED:${new Date().toLocaleTimeString()}`;
      await db.updateOrderStatus(existingOrder.order_id, existingOrder.status, { notes: updatedNotes });

      const refreshedOrder = (await db.getOrderByCode(existingOrder.order_id)) || existingOrder;

      if (message) {
        const { cardHtml, replyMarkup } = generateOrderCard(refreshedOrder, workerName);
        await telegramClient.editMessageText(message.chat.id, message.message_id, cardHtml, replyMarkup);
      }

      await telegramClient.answerCallbackQuery(
        id,
        isResend ? '🔄 কাস্টমারকে নতুন কোডের জন্য নোটিফাই করা হয়েছে!' : '📧 কাস্টমারকে কোডের জন্য নোটিফাই করা হয়েছে!',
        false
      );
      return { success: true, message: 'Code request sent to customer' };
    } catch (codeErr) {
      console.error('[Telegram code_request Error]:', codeErr);
      await telegramClient.answerCallbackQuery(id, `⚠️ Error requesting code: ${String(codeErr)}`, true);
      return { success: false, message: String(codeErr) };
    }
  }

  // 1. ACTION: CLAIM ORDER
  if (action === 'claim') {
    // If already claimed by another worker
    if (
      ['CLAIMED', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(existingOrder.status) &&
      assignedTelegramId &&
      assignedTelegramId !== from.id
    ) {
      await telegramClient.answerCallbackQuery(
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
        await telegramClient.answerCallbackQuery(id, `⚠️ ${claimResult.message}`, true);
        return { success: false, message: claimResult.message, alertText: claimResult.message };
      }

      const order = claimResult.order;
      
      // Update Telegram Card UI in Group to show claimed status and operational buttons
      if (message && order) {
        const { cardHtml, replyMarkup } = generateOrderCard(order, workerName);
        await telegramClient.editMessageText(message.chat.id, message.message_id, cardHtml, replyMarkup);
      }

      // Notify customer on WhatsApp (non-blocking)
      if (order) {
        whatsappService.sendOrderClaimedNotification(order, workerName).catch(err => {
          console.error('[Telegram->WhatsApp Notify Error on Claim]:', err);
        });
      }

      // Trigger queue to dispatch next order in line for other workers!
      import('./queue').then(m => m.telegramQueue.processNextInQueue()).catch(err => {
        console.warn('[Telegram Queue Auto-Dispatch Warning on Claim]:', err);
      });

      await telegramClient.answerCallbackQuery(id, `✅ You have successfully claimed top-up #${orderIdCode}!`, false);
      return { success: true, message: `Claimed by ${workerName}` };
    } catch (claimErr) {
      console.error('[Telegram Claim Error]:', claimErr);
      await telegramClient.answerCallbackQuery(id, `⚠️ Error claiming order: ${String(claimErr)}`, true);
      return { success: false, message: String(claimErr) };
    }
  }

  // 2. ACTION: OUT FOR DELIVERY / PROCESSING
  if (action === 'status_out') {
    // Must be claimed first
    if (!assignedTelegramId && (existingOrder.status === 'PENDING_CLAIM' || existingOrder.status === 'PENDING_PAYMENT')) {
      await telegramClient.answerCallbackQuery(id, `⚠️ প্রথমে 'Claim Top-Up' বাটনে ক্লিক করে অর্ডারটি গ্রহণ করুন!`, true);
      return { success: false, message: 'Order must be claimed first' };
    }

    // Check worker lock
    if (assignedTelegramId && assignedTelegramId !== from.id) {
      await telegramClient.answerCallbackQuery(
        id,
        `⛔ একশন বাতিল!\nএই অর্ডারটি [${assignedWorkerName}] ক্লেইম করেছেন। শুধুমাত্র তিনি অথবা অ্যাডমিন প্যানেল এতে একশন নিতে পারবেন।`,
        true
      );
      return { success: false, message: `Unauthorized: Claimed by ${assignedWorkerName}` };
    }

    // QR Order Validation: Worker must provide the QR screenshot first!
    if (isQrLoginOrder(existingOrder) && !hasQrCodeBeenSent(existingOrder)) {
      await telegramClient.answerCallbackQuery(
        id,
        '📸 অনুগ্রহ করে এই মেসেজে রিপ্লাই করে লগইন QR কোডের ছবি/স্ক্রিনশট পাঠান। বট সাথে সাথে কাস্টমারের WhatsApp-এ পাঠিয়ে দেবে।',
        true
      );
      return { success: false, message: 'Worker must provide QR screenshot first' };
    }

    try {
      const updateResult = await db.updateOrderStatus(orderIdCode, 'OUT_FOR_DELIVERY', { workerTelegramId: from.id });
      if (!updateResult.success) {
        await telegramClient.answerCallbackQuery(id, `⚠️ ${updateResult.message}`, true);
        return { success: false, message: updateResult.message || 'Update failed' };
      }
      const order = updateResult.order;
      
      if (message && order) {
        const { cardHtml, replyMarkup } = generateOrderCard(order, workerName);
        await telegramClient.editMessageText(message.chat.id, message.message_id, cardHtml, replyMarkup);
      }

      await telegramClient.answerCallbackQuery(id, `⚡ Top-up #${orderIdCode} is being processed!`, false);
      return { success: true, message: 'Status updated to OUT_FOR_DELIVERY' };
    } catch (err) {
      console.error('[Telegram Status Out Error]:', err);
      await telegramClient.answerCallbackQuery(id, `⚠️ Failed to update: ${String(err)}`, true);
      return { success: false, message: String(err) };
    }
  }

  // 3. ACTION: MARK DELIVERED / COMPLETED
  if (action === 'status_delivered') {
    // Must be claimed first
    if (!assignedTelegramId && (existingOrder.status === 'PENDING_CLAIM' || existingOrder.status === 'PENDING_PAYMENT')) {
      await telegramClient.answerCallbackQuery(id, `⚠️ প্রথমে 'Claim Top-Up' বাটনে ক্লিক করে অর্ডারটি গ্রহণ করুন!`, true);
      return { success: false, message: 'Order must be claimed first' };
    }

    // Check worker lock
    if (assignedTelegramId && assignedTelegramId !== from.id) {
      await telegramClient.answerCallbackQuery(
        id,
        `⛔ একশন বাতিল!\nএই অর্ডারটি [${assignedWorkerName}] ক্লেইম করেছেন। শুধুমাত্র তিনি অথবা অ্যাডমিন প্যানেল এটি সম্পন্ন করতে পারবেন।`,
        true
      );
      return { success: false, message: `Unauthorized: Claimed by ${assignedWorkerName}` };
    }

    // QR Order Validation: Worker must provide the QR screenshot first!
    if (isQrLoginOrder(existingOrder) && !hasQrCodeBeenSent(existingOrder)) {
      await telegramClient.answerCallbackQuery(
        id,
        '📸 অনুগ্রহ করে এই মেসেজে রিপ্লাই করে লগইন QR কোডের ছবি/স্ক্রিনশট পাঠান। বট সাথে সাথে কাস্টমারের WhatsApp-এ পাঠিয়ে দেবে।',
        true
      );
      return { success: false, message: 'Worker must provide QR screenshot first' };
    }

    try {
      const updateResult = await db.updateOrderStatus(orderIdCode, 'DELIVERED', { workerTelegramId: from.id });
      if (!updateResult.success) {
        await telegramClient.answerCallbackQuery(id, `⚠️ ${updateResult.message}`, true);
        return { success: false, message: updateResult.message || 'Delivery failed' };
      }
      const order = updateResult.order;

      if (order && message) {
        const { cardHtml, replyMarkup } = generateOrderCard(order, workerName);
        await telegramClient.editMessageText(message.chat.id, message.message_id, cardHtml, replyMarkup);

        // Clean up buttons or message from any previous card for this order if different
        if (order.telegram_message_id && order.telegram_message_id !== message.message_id) {
          try {
            await telegramClient.deleteMessage(message.chat.id, order.telegram_message_id);
          } catch {
            await telegramClient.editMessageReplyMarkup(message.chat.id, order.telegram_message_id, { inline_keyboard: [] });
          }
        }

        // Trigger automated WhatsApp delivery confirmation to customer (non-blocking)
        whatsappService.sendOrderDeliveredNotification(order).catch(err => {
          console.error('[Telegram->WhatsApp Notify Error on Delivered]:', err);
        });
      }

      // Trigger queue to dispatch next order in line
      import('./queue').then(m => m.telegramQueue.processNextInQueue()).catch(err => {
        console.warn('[Telegram Queue Auto-Dispatch Warning on Delivered]:', err);
      });

      await telegramClient.answerCallbackQuery(id, `🎉 Top-up #${orderIdCode} marked as Delivered!`, false);
      return { success: true, message: 'Delivered successfully' };
    } catch (err) {
      console.error('[Telegram Delivered Error]:', err);
      await telegramClient.answerCallbackQuery(id, `⚠️ Failed to mark delivered: ${String(err)}`, true);
      return { success: false, message: String(err) };
    }
  }

  // 4. ACTION: CANCEL PROMPT (Show Cancellation Reasons)
  if (action === 'cancel_prompt') {
    // Must be claimed first before cancellation
    if (!assignedTelegramId || existingOrder.status === 'PENDING_CLAIM' || existingOrder.status === 'PENDING_PAYMENT') {
      await telegramClient.answerCallbackQuery(
        id,
        `⚠️ প্রথমে 'Claim Order' বাটনে ক্লিক করে অর্ডারটি গ্রহণ করুন! ক্লেইম করার পরই কেবল বাতিল করা যাবে।`,
        true
      );
      return { success: false, message: 'Order must be claimed first before cancellation' };
    }

    // Check worker lock
    if (assignedTelegramId !== from.id) {
      await telegramClient.answerCallbackQuery(
        id,
        `⛔ একশন বাতিল!\nএই অর্ডারটি [${assignedWorkerName}] ক্লেইম করেছেন। শুধুমাত্র তিনি অথবা অ্যাডমিন প্যানেল এটি বাতিল করতে পারবেন।`,
        true
      );
      return { success: false, message: `Unauthorized: Claimed by ${assignedWorkerName}` };
    }

    // Reset any active pending custom cancellation mode if user navigated back to options
    cancellationStore.clearPendingCancellation(from.id);

    const firstItem = existingOrder.items?.[0];
    const prodName = firstItem?.product_name || '';
    const playerUid = 
      existingOrder.player_uid || 
      (existingOrder.delivery_address as any)?.player_uid || 
      (existingOrder.delivery_address as any)?.name ||
      existingOrder.delivery_address?.address?.match(/(?:UID|Player UID|Email|Gmail|Account|ID):\s*([0-9a-zA-Z@._+-]+)/i)?.[1] ||
      'N/A';
    const accountInfo = getAccountFieldInfo(playerUid, prodName);

    const invoiceId = 
      existingOrder.invoice_id || 
      (existingOrder.delivery_address as any)?.invoice_id || 
      existingOrder.customer_notes?.match(/Invoice:\s*([a-zA-Z0-9_-]+)/i)?.[1] || 
      '';

    const isAutoVerified = Boolean(
      invoiceId ||
      existingOrder.payment_method?.toUpperCase().includes('ZINIPAY') || 
      existingOrder.trx_id?.toUpperCase().startsWith('ZINI') ||
      existingOrder.customer_notes?.includes('Payment Verified via ZiniPay')
    );

    const autoPaidWarning = isAutoVerified 
      ? `\n🟢 <b>পেমেন্ট:</b> ZiniPay অটো-পেইড (Invoice: <code>${invoiceId || 'VERIFIED'}</code>)\n⚠️ <i>(সতর্কতা: এই অর্ডার বাতিল করলে গ্রাহককে অ্যাডমিন প্যানেল থেকে ম্যানুয়াল রিফান্ড দিতে হবে)</i>\n` 
      : '';

    const promptHtml = 
`⚠️ <b>CANCEL ORDER / অর্ডার বাতিলের কারণ নির্বাচন করুন</b>

📦 <b>Order ID:</b> <code>${existingOrder.order_id}</code>
${accountInfo.emoji} <b>${accountInfo.labelEn}:</b> <code>${playerUid}</code>
👷 <b>Worker:</b> <b>${workerName}</b>${autoPaidWarning}
<i>অনুগ্রহ করে নিচে থেকে বাতিলের সুনির্দিষ্ট কারণ নির্বাচন করুন অথবা নিজে কারণ লিখুন:</i>`;

    const promptMarkup = {
      inline_keyboard: [
        [
          { text: `🚫 ভুল ${accountInfo.labelBn} / Invalid`, callback_data: `cancel_confirm:${existingOrder.order_id}:invalid_info` }
        ],
        [
          isAutoVerified
            ? { text: '💸 রিফান্ড প্রয়োজন (Refund Needed)', callback_data: `cancel_confirm:${existingOrder.order_id}:refund_needed` }
            : { text: '💳 ভুয়া / ইনভ্যালিড TrxID', callback_data: `cancel_confirm:${existingOrder.order_id}:fake_trxid` }
        ],
        [
          { text: '📉 স্টক শেষ / সার্ভার সমস্যা', callback_data: `cancel_confirm:${existingOrder.order_id}:stock_out` }
        ],
        [
          { text: '✍️ নিজে কারণ লিখুন (Write Custom Reason)', callback_data: `cancel_custom_prompt:${existingOrder.order_id}` }
        ],
        [
          { text: '👤 কাস্টমার রিকোয়েস্ট (Customer Requested)', callback_data: `cancel_confirm:${existingOrder.order_id}:customer_req` }
        ],
        [
          { text: '🔙 ফিরে যান (Back to Order)', callback_data: `cancel_back:${existingOrder.order_id}` }
        ]
      ]
    };

    if (message) {
      await telegramClient.editMessageText(message.chat.id, message.message_id, promptHtml, promptMarkup);
    }

    await telegramClient.answerCallbackQuery(id, 'বাতিলের কারণ নির্বাচন করুন বা লিখুন', false);
    return { success: true, message: 'Cancellation reason prompt displayed' };
  }

  // 4b. ACTION: CANCEL CUSTOM PROMPT (Worker wants to write custom reason)
  if (action === 'cancel_custom_prompt') {
    // Must be claimed first before cancellation
    if (!assignedTelegramId || existingOrder.status === 'PENDING_CLAIM' || existingOrder.status === 'PENDING_PAYMENT') {
      await telegramClient.answerCallbackQuery(
        id,
        `⚠️ প্রথমে 'Claim Order' বাটনে ক্লিক করে অর্ডারটি গ্রহণ করুন! ক্লেইম করার পরই কেবল বাতিল করা যাবে।`,
        true
      );
      return { success: false, message: 'Order must be claimed first before cancellation' };
    }

    // Check worker lock
    if (assignedTelegramId !== from.id) {
      await telegramClient.answerCallbackQuery(
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
    cancellationStore.setPendingCancellation(from.id, {
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
      await telegramClient.editMessageText(message.chat.id, message.message_id, customPromptHtml, customPromptMarkup);

      // Send a force-reply trigger message so Telegram automatically focuses input in reply mode
      try {
        await telegramClient.sendMessage(message.chat.id, `✍️ <b>[${workerName}]</b>, #${existingOrder.order_id} অর্ডারটি বাতিলের কারণ লিখে পাঠান:\n<i>(এই মেসেজটিতে রিপ্লাই করে কারণটি টাইপ করুন)</i>`, {
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

    await telegramClient.answerCallbackQuery(id, '✍️ এবার চ্যাটে বাতিলের কারণ লিখে পাঠান', false);
    return { success: true, message: 'Custom cancellation prompt active' };
  }

  // 5. ACTION: CANCEL BACK (Return to claimed order view)
  if (action === 'cancel_back') {
    cancellationStore.clearPendingCancellation(from.id);
    if (message) {
      const { cardHtml, replyMarkup } = generateOrderCard(existingOrder, assignedWorkerName || workerName);
      await telegramClient.editMessageText(message.chat.id, message.message_id, cardHtml, replyMarkup);
    }
    await telegramClient.answerCallbackQuery(id, 'ফিরে আসা হয়েছে', false);
    return { success: true, message: 'Returned to order view' };
  }

  // 6. ACTION: CANCEL CONFIRM (Execute cancellation with reason)
  if (action === 'cancel_confirm') {
    // Must be claimed first before cancellation
    if (!assignedTelegramId || existingOrder.status === 'PENDING_CLAIM' || existingOrder.status === 'PENDING_PAYMENT') {
      await telegramClient.answerCallbackQuery(
        id,
        `⚠️ প্রথমে 'Claim Order' বাটনে ক্লিক করে অর্ডারটি গ্রহণ করুন! ক্লেইম করার পরই কেবল বাতিল করা যাবে।`,
        true
      );
      return { success: false, message: 'Order must be claimed first before cancellation' };
    }

    // Check worker lock
    if (assignedTelegramId !== from.id) {
      await telegramClient.answerCallbackQuery(
        id,
        `⛔ একশন বাতিল!\nএই অর্ডারটি [${assignedWorkerName}] ক্লেইম করেছেন। শুধুমাত্র তিনি অথবা অ্যাডমিন প্যানেল এটি বাতিল করতে পারবেন।`,
        true
      );
      return { success: false, message: `Unauthorized: Claimed by ${assignedWorkerName}` };
    }

    const parts = data.split(':');
    const targetOrderIdCode = parts[1];
    const rawReason = parts.slice(2).join(':') || 'Worker cancelled';
    const cancelReason = resolveCancelReason(rawReason, existingOrder);

    const result = await executeOrderCancellation({
      orderIdCode: targetOrderIdCode,
      cancelReason,
      workerTelegramId: from.id,
      workerName,
      workerUsername: from.username,
      chatId: message?.chat.id,
      messageId: message?.message_id
    });

    if (!result.success) {
      await telegramClient.answerCallbackQuery(id, `⚠️ ${result.message}`, true);
      return { success: false, message: result.message };
    }

    await telegramClient.answerCallbackQuery(id, `❌ অর্ডারটি বাতিল করা হয়েছে। কারণ: ${cancelReason}`, true);
    return { success: true, message: `Order cancelled: ${cancelReason}` };
  }

  await telegramClient.answerCallbackQuery(id, 'Unknown action', false);
  return { success: false, message: 'Unknown action' };
}
