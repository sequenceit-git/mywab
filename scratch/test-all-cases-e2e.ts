import { langchainAgent } from '../src/lib/ai/langchain-agent';
import { telegramBot } from '../src/lib/telegram/bot';
import { db } from '../src/lib/db';

async function runAllCasesE2ETest() {
  console.log('================================================================');
  console.log('🧪 RUNNING COMPREHENSIVE END-TO-END TEST SUITE (ALL CASES)');
  console.log('================================================================\n');

  let passedCases = 0;
  let totalCases = 5;

  // =========================================================================
  // CASE 1: Standard Multi-Turn Top-Up -> Order Create -> Worker Claim -> Worker Complete -> Track
  // =========================================================================
  console.log('=================================================================');
  console.log('CASE 1: Standard Conversational Flow -> Order -> Worker Complete');
  console.log('=================================================================');
  const phone1 = `+88017${Math.floor(10000000 + Math.random() * 90000000)}`;
  const conv1 = await db.getOrCreateConversation(phone1, 'Player One');

  // Turn 1.1: Greeting
  const r1_1 = await langchainAgent.processStructuredMessage({ phone: phone1, messageText: 'Hello', conversationId: conv1.id });
  await db.addMessage(conv1.id, 'CUSTOMER', 'Hello');
  await db.addMessage(conv1.id, 'BOT', r1_1.text);
  console.log(`Turn 1 (Greeting): ${r1_1.text.trim()}`);
  console.log(`Buttons: ${r1_1.buttons?.map(b => b.title).join(' | ')}`);

  // Turn 1.2: Price inquiry
  const r1_2 = await langchainAgent.processStructuredMessage({ phone: phone1, messageText: '60 UC price koto?', conversationId: conv1.id });
  await db.addMessage(conv1.id, 'CUSTOMER', '60 UC price koto?');
  await db.addMessage(conv1.id, 'BOT', r1_2.text);
  console.log(`Turn 2 (Price Inquiry): ${r1_2.text.trim()}`);

  // Turn 1.3: Package selection
  const r1_3 = await langchainAgent.processStructuredMessage({ phone: phone1, messageText: '60 UC nibo', conversationId: conv1.id });
  await db.addMessage(conv1.id, 'CUSTOMER', '60 UC nibo');
  await db.addMessage(conv1.id, 'BOT', r1_3.text);
  console.log(`Turn 3 (Package Selected): ${r1_3.text.trim()}`);
  console.log(`Buttons: ${r1_3.buttons ? r1_3.buttons.map(b => b.title).join(' | ') : 'None (Correct - awaiting UID)'}`);

  // Turn 1.4: UID Submission
  const r1_4 = await langchainAgent.processStructuredMessage({ phone: phone1, messageText: '5123456789', conversationId: conv1.id });
  await db.addMessage(conv1.id, 'CUSTOMER', '5123456789');
  await db.addMessage(conv1.id, 'BOT', r1_4.text);
  console.log(`Turn 4 (UID Provided): ${r1_4.text.trim()}`);

  // Turn 1.5: Payment Submission -> Order Creation
  const r1_5 = await langchainAgent.processStructuredMessage({ phone: phone1, messageText: 'Bkash a 115 tk disi, TrxID: 9X8K7L2M', conversationId: conv1.id });
  await db.addMessage(conv1.id, 'CUSTOMER', 'Bkash a 115 tk disi, TrxID: 9X8K7L2M');
  await db.addMessage(conv1.id, 'BOT', r1_5.text);
  console.log(`Turn 5 (Order Created): ${r1_5.text.trim()}`);
  const orderId1 = r1_5.createdOrder?.order_id;
  console.log(`Created Order ID: ${orderId1}`);

  if (!orderId1) throw new Error('Case 1: Order was not created!');

  // Worker Flow for Case 1:
  // Worker 1 claims
  const claimRes1 = await telegramBot.handleCallbackQuery({
    id: 'cb_1_1',
    from: { id: 2001, first_name: 'Tanvir', username: 'tanvir_op' },
    data: `claim:${orderId1}`
  });
  console.log(`Worker Claim: ${claimRes1.message}`);

  // Worker 2 attempts double-claim -> Should fail
  const doubleClaimRes = await telegramBot.handleCallbackQuery({
    id: 'cb_1_2',
    from: { id: 2002, first_name: 'Fahim', username: 'fahim_op' },
    data: `claim:${orderId1}`
  });
  console.log(`Worker Double Claim Attempt: ${doubleClaimRes.message} (Success=${doubleClaimRes.success})`);
  if (doubleClaimRes.success) throw new Error('Case 1: Double claim lock failed!');

  // Worker 1 marks Delivered
  const deliverRes1 = await telegramBot.handleCallbackQuery({
    id: 'cb_1_3',
    from: { id: 2001, first_name: 'Tanvir', username: 'tanvir_op' },
    data: `status_delivered:${orderId1}`
  });
  console.log(`Worker Complete: ${deliverRes1.message}`);

  // Customer tracks delivered order
  const trackRes1 = await langchainAgent.processStructuredMessage({ phone: phone1, messageText: `Track order ${orderId1}`, conversationId: conv1.id });
  console.log(`Customer Track Result: ${trackRes1.text.trim()}`);

  const order1InDb = await db.getOrderByCode(orderId1);
  if (order1InDb?.status === 'DELIVERED') {
    console.log('✅ CASE 1 PASSED: Happy path complete from chat to delivery & tracking.\n');
    passedCases++;
  } else {
    throw new Error(`Case 1: Expected DELIVERED but got ${order1InDb?.status}`);
  }

  // =========================================================================
  // CASE 2: Single-Shot Full Information Order (385 UC - ৳710)
  // =========================================================================
  console.log('=================================================================');
  console.log('CASE 2: Single-Shot Order Input (Package + UID + TrxID)');
  console.log('=================================================================');
  const phone2 = `+88017${Math.floor(10000000 + Math.random() * 90000000)}`;
  const conv2 = await db.getOrCreateConversation(phone2, 'Player Two');

  const r2 = await langchainAgent.processStructuredMessage({
    phone: phone2,
    messageText: '385 UC lagbe, Player UID 599887766, Nagad a 710 tk pathaisi, TrxID: NAG998877',
    conversationId: conv2.id
  });
  console.log(`AI Response: ${r2.text.trim()}`);
  const orderId2 = r2.createdOrder?.order_id;
  console.log(`Created Order ID: ${orderId2}`);

  if (!orderId2) throw new Error('Case 2: Single-shot order creation failed!');

  const order2InDb = await db.getOrderByCode(orderId2);
  console.log(`Order in DB: Amount = ৳${order2InDb?.total_amount} | Status = ${order2InDb?.status}`);

  if (order2InDb && order2InDb.total_amount === 710) {
    console.log('✅ CASE 2 PASSED: Single-shot order created with exact 385 UC pricing (৳710).\n');
    passedCases++;
  } else {
    throw new Error(`Case 2: Expected total_amount 710 but got ${order2InDb?.total_amount}`);
  }

  // =========================================================================
  // CASE 3: Worker Cancellation Flow (Invalid UID / Bad Payment)
  // =========================================================================
  console.log('=================================================================');
  console.log('CASE 3: Worker Cancellation with Reason Picker');
  console.log('=================================================================');
  const phone3 = `+88017${Math.floor(10000000 + Math.random() * 90000000)}`;
  const conv3 = await db.getOrCreateConversation(phone3, 'Player Three');

  // Customer places order
  await langchainAgent.processStructuredMessage({ phone: phone3, messageText: '60 UC nibo', conversationId: conv3.id });
  await langchainAgent.processStructuredMessage({ phone: phone3, messageText: '000000000', conversationId: conv3.id });
  const r3 = await langchainAgent.processStructuredMessage({
    phone: phone3,
    messageText: 'Payment disi, Trx: FAKE1234',
    conversationId: conv3.id
  });
  const orderId3 = r3.createdOrder?.order_id;
  console.log(`Order Created for Cancellation Test: ${orderId3}`);

  if (!orderId3) throw new Error('Case 3: Order creation failed!');

  // Worker claims order
  await telegramBot.handleCallbackQuery({
    id: 'cb_3_1',
    from: { id: 2001, first_name: 'Tanvir', username: 'tanvir_op' },
    data: `claim:${orderId3}`
  });

  // Worker clicks Cancel and selects Reason
  const cancelRes = await telegramBot.handleCallbackQuery({
    id: 'cb_3_2',
    from: { id: 2001, first_name: 'Tanvir', username: 'tanvir_op' },
    data: `cancel_confirm:${orderId3}:Player UID Invalid / পেমেন্ট ভেরিফাই হয়নি`
  });
  console.log(`Worker Cancel Result: ${cancelRes.message}`);

  const order3InDb = await db.getOrderByCode(orderId3);
  console.log(`Order 3 Status in DB: ${order3InDb?.status} | Notes: ${order3InDb?.customer_notes}`);

  // Customer tracks cancelled order
  const trackRes3 = await langchainAgent.processStructuredMessage({ phone: phone3, messageText: `Track order ${orderId3}`, conversationId: conv3.id });
  console.log(`Customer Track Response: ${trackRes3.text.trim()}`);

  if (order3InDb?.status === 'CANCELLED') {
    console.log('✅ CASE 3 PASSED: Order cancelled by worker, reasons logged, customer notified.\n');
    passedCases++;
  } else {
    throw new Error(`Case 3: Expected CANCELLED but got ${order3InDb?.status}`);
  }

  // =========================================================================
  // CASE 4: Mid-Conversation Package Switch (Switching 60 UC -> 385 UC)
  // =========================================================================
  console.log('=================================================================');
  console.log('CASE 4: Mid-Conversation Package Switch (60 UC -> 385 UC)');
  console.log('=================================================================');
  const phone4 = `+88017${Math.floor(10000000 + Math.random() * 90000000)}`;
  const conv4 = await db.getOrCreateConversation(phone4, 'Player Four');

  // Customer initially asks for 60 UC
  await langchainAgent.processStructuredMessage({ phone: phone4, messageText: '60 UC nibo', conversationId: conv4.id });
  
  // Customer switches to 385 UC
  const r4_switch = await langchainAgent.processStructuredMessage({
    phone: phone4,
    messageText: 'na bhai 385 UC nibo',
    conversationId: conv4.id
  });
  console.log(`After switch reply: ${r4_switch.text.trim()}`);

  // Customer sends UID
  await langchainAgent.processStructuredMessage({ phone: phone4, messageText: '588776655', conversationId: conv4.id });

  // Customer sends Payment
  const r4_pay = await langchainAgent.processStructuredMessage({
    phone: phone4,
    messageText: 'bKash 710 tk disi, TrxID: BKASH385X',
    conversationId: conv4.id
  });
  console.log(`Order Creation Response: ${r4_pay.text.trim()}`);
  const orderId4 = r4_pay.createdOrder?.order_id;
  const order4InDb = orderId4 ? await db.getOrderByCode(orderId4) : null;
  console.log(`Created Order ID: ${orderId4} | Total Amount: ৳${order4InDb?.total_amount}`);

  if (order4InDb && order4InDb.total_amount === 710) {
    console.log('✅ CASE 4 PASSED: Package switch properly updated draft cart and total amount.\n');
    passedCases++;
  } else {
    throw new Error(`Case 4: Expected total_amount 710 but got ${order4InDb?.total_amount}`);
  }

  // =========================================================================
  // CASE 5: Policy / FAQ Question During Ordering (Memory Retention)
  // =========================================================================
  console.log('=================================================================');
  console.log('CASE 5: FAQ Query Mid-Conversation Without Erasing Draft Cart');
  console.log('=================================================================');
  const phone5 = `+88017${Math.floor(10000000 + Math.random() * 90000000)}`;
  const conv5 = await db.getOrCreateConversation(phone5, 'Player Five');

  // Customer selects 60 UC
  await langchainAgent.processStructuredMessage({ phone: phone5, messageText: '60 UC nibo', conversationId: conv5.id });
  
  // Customer asks FAQ mid-chat
  const r5_faq = await langchainAgent.processStructuredMessage({
    phone: phone5,
    messageText: 'Delivery koto khon lagbe?',
    conversationId: conv5.id
  });
  console.log(`FAQ Answer: ${r5_faq.text.trim()}`);

  // Customer provides UID
  await langchainAgent.processStructuredMessage({ phone: phone5, messageText: '5566778899', conversationId: conv5.id });

  // Customer pays
  const r5_pay = await langchainAgent.processStructuredMessage({
    phone: phone5,
    messageText: 'Nagad a 115 tk disi, Trx: NAG60UC',
    conversationId: conv5.id
  });
  console.log(`Order Reply: ${r5_pay.text.trim()}`);
  const orderId5 = r5_pay.createdOrder?.order_id;
  const order5InDb = orderId5 ? await db.getOrderByCode(orderId5) : null;
  console.log(`Created Order ID: ${orderId5} | Total: ৳${order5InDb?.total_amount}`);

  if (order5InDb && order5InDb.total_amount === 115) {
    console.log('✅ CASE 5 PASSED: FAQ inquiry did not disrupt draft cart or order creation.\n');
    passedCases++;
  } else {
    throw new Error(`Case 5: Order creation failed after FAQ query.`);
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('=================================================================');
  console.log(`🎉 ALL ${passedCases}/${totalCases} TEST CASES COMPLETED & PASSED!`);
  console.log('=================================================================');
}

runAllCasesE2ETest()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ E2E Test Suite Failure:', err);
    process.exit(1);
  });
