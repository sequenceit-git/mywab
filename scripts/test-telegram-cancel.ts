// Force in-memory mock store for isolated, instant, network-free test execution
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

import { db } from '../src/lib/db';
import { telegramBot } from '../src/lib/telegram/bot';
import { whatsappService } from '../src/lib/whatsapp/service';

// Mock WhatsApp and Telegram outgoing network calls
let lastWhatsAppCancelledCall: { order: any; reason?: string } | null = null;
whatsappService.sendOrderCancelledNotification = async (order: any, reason?: string) => {
  lastWhatsAppCancelledCall = { order, reason: reason as string | undefined };
  return { success: true, messageId: 'mock_wa_msg_id' };
};

let lastTelegramSendMessage: { chatId: any; text: string; options?: any } | null = null;
telegramBot.sendMessage = async (chatId, text, options) => {
  lastTelegramSendMessage = { chatId, text, options };
  return { ok: true, result: { message_id: 9999 } };
};

telegramBot.editMessageText = async () => {};
telegramBot.answerCallbackQuery = async () => {};

async function runTelegramCancellationTestSuite() {
  console.log('🧪 Starting Telegram Worker Bot Cancellation Test Suite...\n');

  // =========================================================================
  // TEST 1: Preset Cancellation ("Invalid UID")
  // =========================================================================
  console.log('===============================================================');
  console.log('TEST 1: Preset Cancellation flow (Fake or Invalid TrxID)');
  console.log('===============================================================');
  {
    const order = await db.createOrder({
      userId: 'user-1',
      deliveryPhone: '+8801811111111',
      items: [{ product_id: 'pkg-1', product_name: 'Free Fire 115 Diamonds', quantity: 1, unit_price: 115 }],
      playerUid: '12345678',
      trxId: 'FAKE123',
      paymentMethod: 'BKASH'
    });

    // Worker 1 claims order
    const worker1 = { id: 1001, first_name: 'Worker', last_name: 'One', username: 'worker1' };
    const claimRes = await telegramBot.handleCallbackQuery({
      id: 'cb-1',
      from: worker1,
      data: `claim:${order.order_id}`,
      message: { message_id: 100, chat: { id: -100123456 } }
    });
    if (!claimRes.success) throw new Error('Test 1 failed: Claim failed');

    // Worker 1 clicks cancel_confirm with preset reason
    const cancelRes = await telegramBot.handleCallbackQuery({
      id: 'cb-2',
      from: worker1,
      data: `cancel_confirm:${order.order_id}:Fake or Invalid TrxID (পেমেন্ট মেলেনি)`,
      message: { message_id: 100, chat: { id: -100123456 } }
    });

    if (!cancelRes.success) throw new Error('Test 1 failed: Cancel confirm failed');

    const updatedOrder = await db.getOrderByCode(order.order_id);
    if (!updatedOrder || updatedOrder.status !== 'CANCELLED') throw new Error('Test 1 failed: Order not CANCELLED');
    if (!updatedOrder.customer_notes?.includes('Fake or Invalid TrxID')) throw new Error('Test 1 failed: Notes not set');
    if (!lastWhatsAppCancelledCall || !lastWhatsAppCancelledCall.reason?.includes('Fake or Invalid TrxID')) {
      throw new Error('Test 1 failed: WhatsApp notification was not triggered with reason');
    }

    console.log('✅ TEST 1 PASSED: Preset cancellation updated DB and triggered WhatsApp notification\n');
  }

  // =========================================================================
  // TEST 2: Custom Cancellation Reason via "✍️ নিজে কারণ লিখুন"
  // =========================================================================
  console.log('===============================================================');
  console.log('TEST 2: Custom Cancellation Reason Interactive Prompt & Text Entry');
  console.log('===============================================================');
  {
    const order = await db.createOrder({
      userId: 'user-2',
      deliveryPhone: '+8801822222222',
      items: [{ product_id: 'pkg-2', product_name: 'PUBG Mobile 180 UC', quantity: 1, unit_price: 390 }],
      playerUid: '55667788',
      trxId: 'TX-999',
      paymentMethod: 'NAGAD'
    });

    const worker2 = { id: 2002, first_name: 'Tanvir', last_name: 'Hasan', username: 'tanvir' };

    // Worker 2 claims order
    await telegramBot.handleCallbackQuery({
      id: 'cb-3',
      from: worker2,
      data: `claim:${order.order_id}`,
      message: { message_id: 200, chat: { id: -100123456 } }
    });

    // 2a. Worker 2 clicks "✍️ নিজে কারণ লিখুন (Write Custom Reason)"
    const promptRes = await telegramBot.handleCallbackQuery({
      id: 'cb-4',
      from: worker2,
      data: `cancel_custom_prompt:${order.order_id}`,
      message: { message_id: 200, chat: { id: -100123456 } }
    });

    if (!promptRes.success) throw new Error('Test 2a failed: cancel_custom_prompt failed');

    // Verify pending state is active
    const pending = telegramBot.getPendingCancellation(worker2.id);
    if (!pending || pending.orderIdCode !== order.order_id) {
      throw new Error('Test 2a failed: Pending cancellation session not registered');
    }

    // Verify ForceReply prompt was dispatched
    if (!lastTelegramSendMessage || !lastTelegramSendMessage.options?.reply_markup?.force_reply) {
      throw new Error('Test 2a failed: ForceReply message not dispatched');
    }
    console.log('   ✓ Custom prompt activated & ForceReply sent');

    // 2b. Worker 2 types custom reason in chat
    const customReason = 'কাস্টমারের আইডিতে ২-স্টেপ ভেরিফিকেশন অন করা, লগইন কোড দিতে হবে';
    const textMsgRes = await telegramBot.handleWorkerTextMessage({
      message_id: 205,
      from: worker2,
      chat: { id: -100123456 },
      text: customReason
    });

    if (!textMsgRes.handled || !textMsgRes.success) {
      throw new Error(`Test 2b failed: Text message not handled successfully: ${JSON.stringify(textMsgRes)}`);
    }

    const updatedOrder = await db.getOrderByCode(order.order_id);
    if (!updatedOrder || updatedOrder.status !== 'CANCELLED') throw new Error('Test 2b failed: Order not marked CANCELLED');
    if (updatedOrder.customer_notes !== customReason) throw new Error(`Test 2b failed: Expected notes to be "${customReason}", got "${updatedOrder.customer_notes}"`);

    // Verify WhatsApp notification was sent with the EXACT custom reason
    if (!lastWhatsAppCancelledCall || lastWhatsAppCancelledCall.reason !== customReason) {
      throw new Error(`Test 2b failed: WhatsApp notification reason mismatch. Expected "${customReason}", got "${lastWhatsAppCancelledCall?.reason}"`);
    }

    // Verify pending state was cleared
    if (telegramBot.getPendingCancellation(worker2.id)) {
      throw new Error('Test 2b failed: Pending state should be cleared after cancellation');
    }

    console.log('✅ TEST 2 PASSED: Custom cancellation reason received, saved, and sent to customer on WhatsApp\n');
  }

  // =========================================================================
  // TEST 3: Slash Command /cancel <order_id> <reason>
  // =========================================================================
  console.log('===============================================================');
  console.log('TEST 3: Direct Slash Command /cancel <order_id> <reason>');
  console.log('===============================================================');
  {
    const order = await db.createOrder({
      userId: 'user-3',
      deliveryPhone: '+8801833333333',
      items: [{ product_id: 'pkg-3', product_name: 'PUBG Mobile 385 UC', quantity: 1, unit_price: 710 }],
      playerUid: '99887766',
      trxId: 'TX-777',
      paymentMethod: 'BKASH'
    });

    const worker3 = { id: 3003, first_name: 'Shakil', username: 'shakil' };

    // Worker 3 directly types: /cancel <order_id> ভুল পাসওয়ার্ড ও জিমেইল ডিসেবল
    const cmdText = `/cancel ${order.order_id} ভুল পাসওয়ার্ড ও জিমেইল ডিসেবল`;
    const cmdRes = await telegramBot.handleWorkerTextMessage({
      message_id: 301,
      from: worker3,
      chat: { id: -100123456 },
      text: cmdText
    });

    if (!cmdRes.handled || !cmdRes.success) {
      throw new Error(`Test 3 failed: Slash command failed: ${JSON.stringify(cmdRes)}`);
    }

    const updatedOrder = await db.getOrderByCode(order.order_id);
    if (!updatedOrder || updatedOrder.status !== 'CANCELLED') throw new Error('Test 3 failed: Order not CANCELLED');
    if (updatedOrder.customer_notes !== 'ভুল পাসওয়ার্ড ও জিমেইল ডিসেবল') {
      throw new Error(`Test 3 failed: Expected reason "ভুল পাসওয়ার্ড ও জিমেইল ডিসেবল", got "${updatedOrder.customer_notes}"`);
    }
    if ((lastWhatsAppCancelledCall?.reason as string) !== 'ভুল পাসওয়ার্ড ও জিমেইল ডিসেবল') {
      throw new Error('Test 3 failed: WhatsApp notification reason mismatch');
    }

    console.log('✅ TEST 3 PASSED: /cancel <order_id> <reason> directly executed and notified\n');
  }

  // =========================================================================
  // TEST 4: Unclaimed / PENDING_CLAIM Order Cancellation
  // =========================================================================
  console.log('===============================================================');
  console.log('TEST 4: Unclaimed Order Direct Cancellation (No Prior Claim Needed)');
  console.log('===============================================================');
  {
    const order = await db.createOrder({
      userId: 'user-4',
      deliveryPhone: '+8801844444444',
      items: [{ product_id: 'pkg-4', product_name: 'Netflix Subscription', quantity: 1, unit_price: 200 }],
      playerUid: 'fake@email.com',
      trxId: '0000',
      paymentMethod: 'NAGAD'
    });

    if (order.status !== 'PENDING_CLAIM') throw new Error('Test 4 setup: Order should be PENDING_CLAIM');

    const worker4 = { id: 4004, first_name: 'AdminWorker', username: 'adminworker' };

    // Worker 4 clicks cancel_prompt directly without claiming first
    const promptRes = await telegramBot.handleCallbackQuery({
      id: 'cb-5',
      from: worker4,
      data: `cancel_prompt:${order.order_id}`,
      message: { message_id: 400, chat: { id: -100123456 } }
    });

    if (!promptRes.success) {
      throw new Error(`Test 4 failed: Unclaimed order cancel_prompt was blocked: ${promptRes.message}`);
    }

    // Worker 4 selects custom reason
    await telegramBot.handleCallbackQuery({
      id: 'cb-6',
      from: worker4,
      data: `cancel_custom_prompt:${order.order_id}`,
      message: { message_id: 400, chat: { id: -100123456 } }
    });

    // Worker 4 enters text
    const textRes = await telegramBot.handleWorkerTextMessage({
      message_id: 405,
      from: worker4,
      chat: { id: -100123456 },
      text: 'ভুয়া পেমেন্ট প্রুফ ও ইনভ্যালিড একাউন্ট'
    });

    if (!textRes.handled || !textRes.success) throw new Error('Test 4 failed: Text execution failed');

    const updatedOrder = await db.getOrderByCode(order.order_id);
    if (!updatedOrder || updatedOrder.status !== 'CANCELLED') throw new Error('Test 4 failed: Order not CANCELLED');
    if (updatedOrder.customer_notes !== 'ভুয়া পেমেন্ট প্রুফ ও ইনভ্যালিড একাউন্ট') {
      throw new Error(`Test 4 failed: Notes mismatch: ${updatedOrder.customer_notes}`);
    }

    console.log('✅ TEST 4 PASSED: Unclaimed order cancelled directly with custom reason without requiring prior claim\n');
  }

  // =========================================================================
  // TEST 5: Worker Lock Protection
  // =========================================================================
  console.log('===============================================================');
  console.log('TEST 5: Worker Lock Protection (Unauthorized worker cannot cancel)');
  console.log('===============================================================');
  {
    const order = await db.createOrder({
      userId: 'user-5',
      deliveryPhone: '+8801855555555',
      items: [{ product_id: 'pkg-5', product_name: 'Test Product', quantity: 1, unit_price: 500 }],
      playerUid: '88776655',
      trxId: 'TX-500',
      paymentMethod: 'BKASH'
    });

    const ownerWorker = { id: 5001, first_name: 'OriginalOwner', username: 'owner' };
    const intruderWorker = { id: 5002, first_name: 'Intruder', username: 'intruder' };

    // Owner claims order
    await telegramBot.handleCallbackQuery({
      id: 'cb-7',
      from: ownerWorker,
      data: `claim:${order.order_id}`,
      message: { message_id: 500, chat: { id: -100123456 } }
    });

    // Intruder tries to click cancel_prompt
    const intrudeRes = await telegramBot.handleCallbackQuery({
      id: 'cb-8',
      from: intruderWorker,
      data: `cancel_prompt:${order.order_id}`,
      message: { message_id: 500, chat: { id: -100123456 } }
    });

    if (intrudeRes.success) throw new Error('Test 5 failed: Intruder should be rejected from cancel_prompt');

    // Intruder tries to send custom prompt
    const intrudeCustomRes = await telegramBot.handleCallbackQuery({
      id: 'cb-9',
      from: intruderWorker,
      data: `cancel_custom_prompt:${order.order_id}`,
      message: { message_id: 500, chat: { id: -100123456 } }
    });

    if (intrudeCustomRes.success) throw new Error('Test 5 failed: Intruder should be rejected from cancel_custom_prompt');

    // Intruder tries to send /cancel command
    const intrudeCmdRes = await telegramBot.handleWorkerTextMessage({
      message_id: 505,
      from: intruderWorker,
      chat: { id: -100123456 },
      text: `/cancel ${order.order_id} malicious cancel attempt`
    });

    if (intrudeCmdRes.success) throw new Error('Test 5 failed: Intruder /cancel command should fail');

    const orderStillClaimed = await db.getOrderByCode(order.order_id);
    if (!orderStillClaimed || orderStillClaimed.status !== 'CLAIMED') {
      throw new Error('Test 5 failed: Order should still be in CLAIMED status');
    }

    console.log('✅ TEST 5 PASSED: Unauthorized worker prevented from cancelling other workers claimed orders\n');
  }

  console.log('===============================================================');
  console.log('🎉 ALL 5 TELEGRAM CANCELLATION TESTS PASSED WITH 100% SUCCESS!');
  console.log('===============================================================\n');
}

runTelegramCancellationTestSuite().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
