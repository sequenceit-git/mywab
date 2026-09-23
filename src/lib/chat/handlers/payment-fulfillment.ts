import { db } from '../../db';
import { whatsappService } from '../../whatsapp/service';
import { telegramBot } from '../../telegram/bot';
import { zinipayClient } from '../../zinipay/client';
import { orderPaymentService } from '../../services/order-payment';
import { ConversationSessionState } from '@/types';
import { handleUidInput } from './order-creation';
import { sendWelcomeAndGameList } from './catalog-navigation';

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

  if (order && !invoiceId && order.invoice_id) {
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

  // Call ZiniPay verify
  const verifyRes = await zinipayClient.verifyInvoice(invoiceId);

  if (verifyRes.status === 'COMPLETED') {
    const trxId = verifyRes.transaction_id || `ZINI-${Date.now()}`;
    const paymentMethod = verifyRes.payment_method || 'bKash';
    const amount = Number(verifyRes.amount) || order?.total_amount || 0;

    // Clear draft
    if (order) {
      db.clearSessionDraft(conversationId, order.order_id);
    }
    db.setSessionState(conversationId, { step: 'ORDER_PLACED' });

    await orderPaymentService.handlePaymentVerified({
      orderIdCode: order?.order_id,
      invoiceId,
      trxId,
      paymentMethod,
      amount,
      customerName: verifyRes.cus_name
    });
    return;
  }

  if (verifyRes.status === 'PENDING') {
    const payUrl = order?.payment_url || session.draftOrder?.paymentUrl;
    const pendingMsg = 
`⏳ *পেমেন্ট এখনও পেন্ডিং রয়েছে!*

আপনার পেমেন্টটি এখনও আমাদের গেটওয়েতে জমা পড়েনি। 
আপনি যদি এখনও টাকা না পাঠিয়ে থাকেন, তবে নিচের লিংকে গিয়ে পেমেন্ট সম্পন্ন করুন:

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
      '⚠️ কোডটি স্পষ্টভাবে বুঝতে পারিনি। অনুগ্রহ করে আপনার ইমেইলে পাওয়া ভেরিফিকেশন কোডটি সরাসরি টাইপ করে পাঠান।'
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
