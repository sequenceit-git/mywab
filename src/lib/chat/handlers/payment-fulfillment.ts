import { db } from '../../db';
import { whatsappService } from '../../whatsapp/service';
import { telegramBot } from '../../telegram/bot';
import { zinipayClient } from '../../zinipay/client';
import { orderPaymentService } from '../../services/order-payment';
import { ConversationSessionState } from '@/types';
import { handleUidInput } from './order-creation';
import { sendWelcomeAndGameList } from './catalog-navigation';
import { handleTrackOrder } from './info-handlers';

// Right after paying, ZiniPay can report PENDING for a few seconds — re-check before answering.
const VERIFY_RETRY_DELAYS_MS = [2500, 2500];
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Real-time Check Payment status via ZiniPay API
 */
export async function handleCheckPayment(
  phone: string,
  conversationId: string,
  triggerId: string,
  rawText: string,
  session: ConversationSessionState
): Promise<void> {
  const orderId = triggerId.startsWith('check_pay:')
    ? triggerId.split(':')[1]?.trim()
    : session.draftOrder?.pendingOrderId || session.lastOrderId;

  let invoiceId = session.draftOrder?.invoiceId;

  let order = orderId ? await db.getOrderByCode(orderId) : null;
  if (!order && invoiceId) {
    order = await db.getOrderByInvoiceId(invoiceId);
  }

  // Session is in-memory and may be lost (restart / menu navigation) —
  // fall back to the customer's newest unpaid order with a ZiniPay invoice.
  if (!order) {
    const orders = await db.getOrdersByPhone(phone);
    order = orders.find(o => o.status === 'PENDING_PAYMENT' && (o.invoice_id || o.payment_url)) || null;
  }

  const isPaidOrder = (o: typeof order) => Boolean(o) && o!.status !== 'PENDING_PAYMENT' && o!.status !== 'CANCELLED';

  // Typed "check" (no explicit order id) but the session points at an older, already-paid order —
  // prefer the customer's newest unpaid order instead.
  if (isPaidOrder(order) && !triggerId.startsWith('check_pay:')) {
    const orders = await db.getOrdersByPhone(phone);
    const unpaid = orders.find(o => o.status === 'PENDING_PAYMENT' && (o.invoice_id || o.payment_url));
    if (unpaid) {
      order = unpaid;
      invoiceId = undefined; // session invoice belonged to the other order
    }
  }

  // Already paid (by the webhook or an earlier tap) — answer with the order status instead of staying silent.
  if (order && isPaidOrder(order)) {
    await whatsappService.sendMessage(phone, `✅ *আপনার পেমেন্ট ইতিমধ্যে গৃহীত হয়েছে!* অর্ডার *#${order.order_id}* এর বর্তমান অবস্থা নিচে দেখুন:`);
    await handleTrackOrder(phone, conversationId, `track:${order.order_id}`, '');
    return;
  }

  // The order's own invoice is authoritative; the session invoice may belong to a different order.
  if (order?.invoice_id) {
    invoiceId = order.invoice_id;
  }

  if (!invoiceId && order?.payment_url) {
    invoiceId = zinipayClient.extractInvoiceId(order.payment_url);
  }

  if (!invoiceId) {
    const payUrl = order?.payment_url || session.draftOrder?.paymentUrl;
    if (payUrl) {
      await whatsappService.sendMessage(
        phone,
        `⚡ *আপনার পেমেন্ট লিংক:*\n${payUrl}\n\nঅনুগ্রহ করে লিংকে গিয়ে বিকাশ/নগদ/রকেটে পেমেন্ট সম্পন্ন করুন।`
      );
      const buttons = [
        { id: `check_pay:${order?.order_id || session.draftOrder?.pendingOrderId || ''}`, title: '🔄 পেমেন্ট চেক করুন' },
        { id: 'btn_main_menu', title: '🔙 মেইন মেনু' }
      ];
      await whatsappService.sendInteractiveButtons(phone, `পেমেন্ট সম্পন্ন করার পর নিচের বাটন চাপুন:`, buttons, 'পেমেন্ট চেক');
      return;
    }

    if (session.draftOrder?.playerUid) {
      await handleUidInput(phone, conversationId, session.draftOrder.playerUid, session);
      return;
    }

    await whatsappService.sendInteractiveButtons(
      phone,
      `⚠️ *কোনো সক্রিয় পেমেন্ট ইনভয়েস পাওয়া যায়নি!*\n\nঅনুগ্রহ করে নতুন অর্ডার করতে নিচের বাটনে চাপ দিন:`,
      [
        { id: 'btn_main_menu', title: '🎮 নতুন অর্ডার' }
      ],
      'নতুন অর্ডার'
    );
    return;
  }

  // Immediate feedback so the tap never looks ignored
  await whatsappService.sendMessage(phone, '⏳ *পেমেন্ট যাচাই করা হচ্ছে...* অনুগ্রহ করে কয়েক সেকেন্ড অপেক্ষা করুন।');

  // Call ZiniPay verify (with short re-checks while it is still PENDING)
  let verifyRes = await zinipayClient.verifyInvoice(invoiceId);
  for (const delay of VERIFY_RETRY_DELAYS_MS) {
    if (verifyRes.status !== 'PENDING') break;
    await sleep(delay);
    verifyRes = await zinipayClient.verifyInvoice(invoiceId);
  }

  // ZiniPay API / network error — don't tell the customer their payment failed
  if (verifyRes.error) {
    const buttons = [
      { id: `check_pay:${order?.order_id || ''}`, title: '🔄 আবার চেক করুন' },
      { id: 'btn_main_menu', title: '🔙 মেইন মেনু' }
    ];
    await whatsappService.sendInteractiveButtons(
      phone,
      `⚠️ *এই মুহূর্তে পেমেন্ট যাচাই করা যাচ্ছে না।*\n\nআপনি পেমেন্ট করে থাকলে চিন্তা করবেন না — নিশ্চিত হওয়া মাত্র স্বয়ংক্রিয়ভাবে মেসেজ পাবেন। কিছুক্ষণ পর আবার চেক করুন।`,
      buttons,
      'পেমেন্ট চেক'
    );
    return;
  }

  if (verifyRes.status === 'COMPLETED') {
    const trxId = verifyRes.transaction_id || `ZINI-${Date.now()}`;
    const paymentMethod = verifyRes.payment_method || 'bKash';
    const amount = Number(verifyRes.amount) || order?.total_amount || 0;

    // Clear draft
    if (order) {
      db.clearSessionDraft(conversationId, order.order_id);
    }
    db.setSessionState(conversationId, { step: 'ORDER_PLACED' });

    const result = await orderPaymentService.handlePaymentVerified({
      orderIdCode: order?.order_id,
      invoiceId,
      trxId,
      paymentMethod,
      amount,
      customerName: verifyRes.cus_name
    });

    // Webhook (or an earlier tap) is already handling / has handled this payment — confirm instead of silence.
    if (result.alreadyProcessed) {
      const code = result.order?.order_id || order?.order_id || '';
      await whatsappService.sendInteractiveButtons(
        phone,
        `✅ *পেমেন্ট নিশ্চিত হয়েছে!* অর্ডার *#${code}* প্রসেস হচ্ছে — আপডেট স্বয়ংক্রিয়ভাবে এখানে পাবেন।`,
        [
          { id: `track:${code}`, title: '📦 অর্ডার স্ট্যাটাস' },
          { id: 'btn_main_menu', title: '🎮 মেইন মেনু' }
        ],
        'পেমেন্ট নিশ্চিত'
      );
    }
    return;
  }

  if (verifyRes.status === 'PENDING') {
    const payUrl = order?.payment_url || session.draftOrder?.paymentUrl;
    const pendingMsg = 
`⏳ *পেমেন্ট এখনও নিশ্চিত হয়নি!*

আপনি যদি মাত্র পেমেন্ট করে থাকেন, গেটওয়ে থেকে নিশ্চিত হতে কয়েক সেকেন্ড লাগতে পারে — নিশ্চিত হওয়া মাত্র স্বয়ংক্রিয়ভাবে মেসেজ পাবেন, অথবা একটু পর আবার চেক করুন।

এখনও টাকা না পাঠিয়ে থাকলে নিচের লিংকে গিয়ে পেমেন্ট সম্পন্ন করুন:

🔗 *পেমেন্ট লিংক:*
${payUrl || 'https://secure.zinipay.com'}

*(পেমেন্ট সম্পন্ন করার পর নিচের বাটনে চাপ দিন)*`;

    const buttons = [
      { id: `check_pay:${order?.order_id || ''}`, title: '🔄 আবার চেক করুন' },
      { id: 'btn_main_menu', title: '🔙 মেইন মেনু' }
    ];

    await whatsappService.sendInteractiveButtons(phone, pendingMsg, buttons, 'পেমেন্ট পেন্ডিং');
    return;
  }

  // FAILED or other
  const failedMsg = 
`❌ *পেমেন্ট সম্পন্ন হয়নি বা বাতিল হয়েছে।*

আপনার আগের পেমেন্ট সেশনটি সফল হয়নি। অনুগ্রহ করে নতুন করে চেষ্টা করুন:`;

  const buttons = [
    { id: `retry_pay:${session.draftOrder?.playerUid || 'new'}`, title: '🔄 আবার চেষ্টা করুন' },
    { id: 'btn_main_menu', title: '🎮 নতুন অর্ডার' }
  ];

  await whatsappService.sendInteractiveButtons(phone, failedMsg, buttons, 'পেমেন্ট ব্যর্থ');
}

/**
 * Handle Payment Method Selection -> Route to ZiniPay Gateway
 */
export async function handlePaymentMethodSelection(
  phone: string,
  conversationId: string,
  methodInput: string,
  session: ConversationSessionState
): Promise<void> {
  const payUrl = session.draftOrder?.paymentUrl;
  if (payUrl) {
    await whatsappService.sendMessage(
      phone,
      `⚡ *স্বয়ংক্রিয় পেমেন্ট গেটওয়ে*\n\nবিকাশ, নগদ বা রকেটে পেমেন্ট সম্পন্ন করতে নিচের লিংকে ক্লিক করুন:\n👉 ${payUrl}\n\nপেমেন্ট সম্পন্ন হওয়ার পর অটোমেটিক অর্ডার ডেলিভারি হয়ে যাবে।`
    );
    const buttons = [
      { id: `check_pay:${session.draftOrder?.pendingOrderId || ''}`, title: '🔄 পেমেন্ট চেক করুন' },
      { id: 'btn_main_menu', title: '🔙 মেইন মেনু' }
    ];
    await whatsappService.sendInteractiveButtons(phone, `পেমেন্ট সম্পন্ন করার পর নিচের বাটন চাপুন:`, buttons, 'পেমেন্ট চেক');
    return;
  }

  if (session.draftOrder?.playerUid) {
    await handleUidInput(phone, conversationId, session.draftOrder.playerUid, session);
    return;
  }

  await sendWelcomeAndGameList(phone, conversationId);
}

/**
 * Auto Payment verification for any payment check text or inquiries
 */
export async function handleTrxIdInput(
  phone: string,
  conversationId: string,
  userId: string,
  rawText: string,
  session: ConversationSessionState
): Promise<void> {
  await handleCheckPayment(phone, conversationId, '', rawText, session);
}

/**
 * Handle PUBG QR customer action (QR Scanned vs Need New QR)
 */
export async function handleQrAction(
  phone: string,
  conversationId: string,
  triggerId: string,
  rawText: string,
  actionType: 'DONE' | 'REFRESH'
): Promise<void> {
  let orderIdCode = '';
  if (triggerId.startsWith('qr_done:')) {
    orderIdCode = triggerId.replace('qr_done:', '').trim();
  } else if (triggerId.startsWith('qr_refresh:')) {
    orderIdCode = triggerId.replace('qr_refresh:', '').trim();
  }

  // If order ID not in trigger, lookup recent active order for this phone
  if (!orderIdCode) {
    const activeOrders = await db.getOrders({ limit: 10 });
    const cleanPhone = phone.replace(/\D/g, '');
    const recentOrder = activeOrders.find(o => 
      o.delivery_phone.replace(/\D/g, '').includes(cleanPhone) &&
      ['PROCESSING', 'CLAIMED', 'PENDING_CLAIM'].includes(o.status)
    );
    if (recentOrder) {
      orderIdCode = recentOrder.order_id;
    }
  }

  if (actionType === 'DONE') {
    const replyMsg = 
`✅ *ধন্যবাদ! আপনার QR কোড স্ক্যান সম্পন্ন হয়েছে।*

আমাদের এজেন্ট এখন আপনার অ্যাকাউন্টে লগইন করে UC টপ-আপ সম্পন্ন করছেন। অনুগ্রহ করে ৫-১৫ মিনিট অপেক্ষা করুন, এর মধ্যে আপনার অর্ডার সম্পন্ন হয়ে যাবে। দয়া করে এই সময়ের মধ্যে গেমে লগইন করবেন না। ⏳✨`;

    const buttons = [
      { id: `track:${orderIdCode || ''}`, title: '📦 অর্ডার স্ট্যাটাস' },
      { id: 'btn_main_menu', title: '🎮 মেইন মেনু' }
    ];

    await whatsappService.sendInteractiveButtons(phone, replyMsg, buttons, 'QR স্ক্যান নিশ্চিত');
    await db.addMessage({
      conversationId,
      sender: 'BOT',
      content: replyMsg,
      metadata: { step: 'QR_SCANNED', orderId: orderIdCode }
    });

    if (orderIdCode) {
      await telegramBot.notifyWorkerQrAction(orderIdCode, 'SCANNED');
    }
  } else {
    // REFRESH
    const replyMsg = 
`🔄 *নতুন QR কোডের জন্য রিকোয়েস্ট পাঠানো হয়েছে।*

আমাদের এজেন্ট কিছুক্ষণের মধ্যেই একটি নতুন Login QR কোড পাঠাচ্ছেন। দয়া করে একটু অপেক্ষা করুন... ⏳`;

    const buttons = [
      { id: `track:${orderIdCode || ''}`, title: '📦 অর্ডার স্ট্যাটাস' },
      { id: 'btn_main_menu', title: '❌ বাতিল করুন' }
    ];

    await whatsappService.sendInteractiveButtons(phone, replyMsg, buttons, 'নতুন QR রিকোয়েস্ট');
    await db.addMessage({
      conversationId,
      sender: 'BOT',
      content: replyMsg,
      metadata: { step: 'QR_REFRESH_REQUESTED', orderId: orderIdCode }
    });

    if (orderIdCode) {
      await telegramBot.notifyWorkerQrAction(orderIdCode, 'REFRESH_REQUESTED');
    }
  }
}

/**
 * Capture customer's email verification code and forward it to the Telegram worker
 * (PUBG KR / eFootball "code method" fulfillment only — triggered when worker requests a code via Telegram)
 */
export async function handleVerificationCodeInput(
  phone: string,
  conversationId: string,
  rawText: string,
  session: ConversationSessionState
): Promise<void> {
  const code = rawText.trim();

  if (!code || code.length < 3) {
    await whatsappService.sendMessage(
      phone,
      '⚠️ কোডটি স্পষ্টভাবে বুঝতে পারিনি। অনুগ্রহ করে আপনার গেম ইমেইলে পাওয়া ভেরিফিকেশন কোডটি সরাসরি টাইপ করে পাঠান।'
    );
    return;
  }

  let orderIdCode = session.draftOrder.pendingOrderId || '';

  // If not tracked in session (e.g. session lost on serverless restart), fall back to recent active order for this phone
  if (!orderIdCode) {
    const activeOrders = await db.getOrders({ limit: 10 });
    const cleanPhone = phone.replace(/\D/g, '');
    const recentOrder = activeOrders.find(o =>
      o.delivery_phone.replace(/\D/g, '').includes(cleanPhone) &&
      ['PROCESSING', 'CLAIMED'].includes(o.status)
    );
    if (recentOrder) {
      orderIdCode = recentOrder.order_id;
    }
  }

  const replyMsg =
`✅ *কোডটি পাওয়া গেছে!*

আমাদের টপ-আপ টিমকে কোডটি পাঠানো হয়েছে। অনুগ্রহ করে একটু অপেক্ষা করুন — কোড দিয়ে লগইন সফল হলে আপনি কনফার্মেশন মেসেজ পাবেন। কোডের মেয়াদ শেষ হয়ে গেলে আমরা আপনাকে আবার নতুন কোডের জন্য জানাবো। ⏳✨`;

  const buttons = [
    { id: `track:${orderIdCode || ''}`, title: '📦 অর্ডার স্ট্যাটাস' },
    { id: 'btn_main_menu', title: '🎮 মেইন মেনু' }
  ];

  await whatsappService.sendInteractiveButtons(phone, replyMsg, buttons, 'কোড রিসিভড');
  await db.addMessage({
    conversationId,
    sender: 'BOT',
    content: replyMsg,
    metadata: { step: 'CODE_RECEIVED', orderId: orderIdCode }
  });

  db.setSessionState(conversationId, {
    step: 'ORDER_PLACED',
    draftOrder: { ...session.draftOrder, pendingOrderId: undefined }
  });

  if (orderIdCode) {
    await telegramBot.notifyWorkerCodeReceived(orderIdCode, code);
  }
}
