import { langchainAgent } from '../src/lib/ai/langchain-agent';
import { db } from '../src/lib/db';

async function runFullConversationOrderTest() {
  const customerPhone = `+88017${Math.floor(10000000 + Math.random() * 90000000)}`;
  const customerName = 'Rahim Gaming';
  const playerUid = '5123456789';
  const trxId = '9X8K7L2M';

  console.log('================================================================');
  console.log(`🚀 STARTING FULL E2E ORDER FLOW TEST FOR ${customerPhone} (${customerName})`);
  console.log('================================================================\n');

  // Step 0: Initialize customer & persistent conversation
  const user = await db.getOrCreateUser(customerPhone, customerName);
  const conv = await db.getOrCreateConversation(customerPhone, customerName);
  console.log(`[Init] Customer ID: ${user.id} | Conversation ID: ${conv.id}\n`);

  // -------------------------------------------------------------
  // TURN 1: Customer Greeting
  // -------------------------------------------------------------
  console.log('-------------------------------------------------------------');
  console.log('TURN 1: Customer Greeting ("Hi")');
  console.log('-------------------------------------------------------------');
  await db.addMessage(conv.id, 'CUSTOMER', 'Hi');
  const res1 = await langchainAgent.processStructuredMessage({
    phone: customerPhone,
    messageText: 'Hi',
    conversationId: conv.id
  });
  await db.addMessage(conv.id, 'BOT', res1.text);
  console.log(`AI: ${res1.text.trim()}`);
  console.log(`Buttons: ${res1.buttons ? res1.buttons.map(b => `[${b.title} (ID: ${b.id})]`).join(' ') : 'None'}`);

  // -------------------------------------------------------------
  // TURN 2: Customer asks price or selects 60 UC package
  // -------------------------------------------------------------
  console.log('\n-------------------------------------------------------------');
  console.log('TURN 2: Customer selects package ("60 UC nibo")');
  console.log('-------------------------------------------------------------');
  await db.addMessage(conv.id, 'CUSTOMER', '60 UC nibo');
  const res2 = await langchainAgent.processStructuredMessage({
    phone: customerPhone,
    messageText: '60 UC nibo',
    conversationId: conv.id
  });
  await db.addMessage(conv.id, 'BOT', res2.text);
  console.log(`AI: ${res2.text.trim()}`);
  console.log(`Buttons: ${res2.buttons ? res2.buttons.map(b => `[${b.title} (ID: ${b.id})]`).join(' ') : 'None (Correct - keeping keyboard clear)'}`);
  
  const stateTurn2 = db.getSessionState(conv.id);
  console.log(`Cart State:`, stateTurn2.draftOrder?.items);

  // -------------------------------------------------------------
  // TURN 3: Customer provides Player UID
  // -------------------------------------------------------------
  console.log('\n-------------------------------------------------------------');
  console.log(`TURN 3: Customer provides Player UID ("${playerUid}")`);
  console.log('-------------------------------------------------------------');
  await db.addMessage(conv.id, 'CUSTOMER', playerUid);
  const res3 = await langchainAgent.processStructuredMessage({
    phone: customerPhone,
    messageText: playerUid,
    conversationId: conv.id
  });
  await db.addMessage(conv.id, 'BOT', res3.text);
  console.log(`AI: ${res3.text.trim()}`);
  console.log(`Buttons: ${res3.buttons ? res3.buttons.map(b => `[${b.title} (ID: ${b.id})]`).join(' ') : 'None (Correct - keeping keyboard clear)'}`);

  const stateTurn3 = db.getSessionState(conv.id);
  console.log(`Cart State:`, {
    items: stateTurn3.draftOrder?.items,
    playerUid: stateTurn3.draftOrder?.playerUid
  });

  // -------------------------------------------------------------
  // TURN 4: Customer sends Payment details with TrxID
  // -------------------------------------------------------------
  console.log('\n-------------------------------------------------------------');
  console.log(`TURN 4: Customer sends Payment details ("Bkash a 115 tk disi, TrxID: ${trxId}")`);
  console.log('-------------------------------------------------------------');
  const paymentMsg = `Bkash a 115 tk disi, TrxID: ${trxId}`;
  await db.addMessage(conv.id, 'CUSTOMER', paymentMsg);
  const res4 = await langchainAgent.processStructuredMessage({
    phone: customerPhone,
    messageText: paymentMsg,
    conversationId: conv.id
  });
  await db.addMessage(conv.id, 'BOT', res4.text);
  console.log(`AI: ${res4.text.trim()}`);
  console.log(`Created Order Result:`, res4.createdOrder);
  console.log(`Buttons: ${res4.buttons ? res4.buttons.map(b => `[${b.title} (ID: ${b.id})]`).join(' ') : 'None'}`);

  const createdOrderId = res4.createdOrder?.order_id;
  if (!createdOrderId) {
    console.error('\n❌ FAIL: Order was not created in Turn 4!');
    process.exit(1);
  }

  // -------------------------------------------------------------
  // TURN 5: Customer clicks "📦 অর্ডার ট্র্যাক" (Track Order button)
  // -------------------------------------------------------------
  console.log('\n-------------------------------------------------------------');
  console.log(`TURN 5: Customer clicks Track Order Button ("Track order ${createdOrderId}")`);
  console.log('-------------------------------------------------------------');
  const trackMsg = `Track order ${createdOrderId}`;
  await db.addMessage(conv.id, 'CUSTOMER', trackMsg);
  const res5 = await langchainAgent.processStructuredMessage({
    phone: customerPhone,
    messageText: trackMsg,
    conversationId: conv.id
  });
  await db.addMessage(conv.id, 'BOT', res5.text);
  console.log(`AI: ${res5.text.trim()}`);

  // -------------------------------------------------------------
  // STEP 6: Verify Database Record
  // -------------------------------------------------------------
  console.log('\n-------------------------------------------------------------');
  console.log('STEP 6: Verifying Order Record in Database');
  console.log('-------------------------------------------------------------');
  const dbOrders = await db.getOrders();
  const foundOrder = dbOrders.find(o => o.order_id === createdOrderId || o.id === createdOrderId);

  if (foundOrder) {
    console.log('✅ Found Order in DB:');
    console.log({
      id: foundOrder.id,
      delivery_phone: foundOrder.delivery_phone,
      total_amount: foundOrder.total_amount,
      status: foundOrder.status,
      items: foundOrder.items,
      delivery_address: foundOrder.delivery_address,
      customer_notes: foundOrder.customer_notes
    });
    console.log('\n================================================================');
    console.log('🎉 FULL CONVERSATION & ORDER CREATION TEST PASSED SUCCESSFULLY!');
    console.log('================================================================');
  } else {
    console.error(`❌ Order ${createdOrderId} not found in DB!`);
    process.exit(1);
  }
}

runFullConversationOrderTest()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal Test Error:', err);
    process.exit(1);
  });
