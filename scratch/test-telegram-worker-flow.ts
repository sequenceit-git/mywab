import { telegramBot } from '../src/lib/telegram/bot';
import { db } from '../src/lib/db';

async function testTelegramWorkerLifecycle() {
  console.log('================================================================');
  console.log('🚀 TESTING TELEGRAM WORKER FULL LIFECYCLE FLOW');
  console.log('================================================================\n');

  const testPhone = `+88017${Math.floor(10000000 + Math.random() * 90000000)}`;
  const customerName = 'Pubg Pro Player';
  const playerUid = '5987654321';
  const trxId = 'TRX998877';

  // 1. Create Customer and Order
  console.log('Step 1: Creating Customer & Top-Up Order in DB...');
  const user = await db.getOrCreateUser(testPhone, customerName);
  const order = await db.createOrder({
    userId: user.id,
    deliveryPhone: testPhone,
    playerUid,
    trxId,
    paymentMethod: 'BKASH',
    items: [
      {
        product_name: '৬০ ইউসি (60 UC)',
        unit_price: 115,
        quantity: 1
      }
    ]
  });

  console.log(`✅ Order Created: ID = ${order.order_id} (UUID: ${order.id}) | Status = ${order.status}`);

  // 2. Dispatch to Telegram Worker Bot
  console.log('\nStep 2: Dispatching Order to Telegram Worker Group...');
  const dispatchResult = await telegramBot.dispatchNewOrder(order);
  console.log('Dispatch Result:', dispatchResult);

  // 3. Worker 1 ("Karim - Operator 1", TG ID: 1001) claims the order
  console.log('\nStep 3: Worker 1 (Karim, TG ID: 1001) clicks "⚡ Claim Top-Up"...');
  const claimRes1 = await telegramBot.handleCallbackQuery({
    id: 'cb_query_001',
    from: {
      id: 1001,
      first_name: 'Karim',
      last_name: 'TopUpOperator',
      username: 'karim_operator'
    },
    message: {
      message_id: dispatchResult.messageId || 99991,
      chat: { id: -100123456789 }
    },
    data: `claim:${order.order_id}`
  });

  console.log('Worker 1 Claim Result:', claimRes1);

  // Verify DB state after Worker 1 claim
  const orderAfterClaim = await db.getOrderByCode(order.order_id);
  console.log(`DB Status after Worker 1 Claim: ${orderAfterClaim?.status} | Worker: ${orderAfterClaim?.current_worker?.full_name || 'N/A'}`);

  if (orderAfterClaim?.status !== 'CLAIMED' && orderAfterClaim?.status !== 'PROCESSING') {
    console.error('❌ FAIL: Order status did not move to CLAIMED / PROCESSING!');
    process.exit(1);
  }

  // 4. Worker 2 ("Rahim - Operator 2", TG ID: 1002) attempts to steal/claim the same order
  console.log('\nStep 4: Worker 2 (Rahim, TG ID: 1002) tries to claim the same order (Double-claim test)...');
  const claimRes2 = await telegramBot.handleCallbackQuery({
    id: 'cb_query_002',
    from: {
      id: 1002,
      first_name: 'Rahim',
      last_name: 'Competitor',
      username: 'rahim_operator'
    },
    message: {
      message_id: dispatchResult.messageId || 99991,
      chat: { id: -100123456789 }
    },
    data: `claim:${order.order_id}`
  });

  console.log('Worker 2 Claim Attempt Result (Should be rejected):', claimRes2);
  if (claimRes2.success) {
    console.error('❌ FAIL: Worker 2 was allowed to claim an already-claimed order!');
    process.exit(1);
  } else {
    console.log('✅ PASS: Double-claim locked and rejected correctly!');
  }

  // 5. Worker 1 completes the top-up order
  console.log('\nStep 5: Worker 1 (Karim) clicks "✅ Top-Up Completed"...');
  const deliverRes = await telegramBot.handleCallbackQuery({
    id: 'cb_query_003',
    from: {
      id: 1001,
      first_name: 'Karim',
      last_name: 'TopUpOperator',
      username: 'karim_operator'
    },
    message: {
      message_id: dispatchResult.messageId || 99991,
      chat: { id: -100123456789 }
    },
    data: `status_delivered:${order.order_id}`
  });

  console.log('Worker 1 Complete Result:', deliverRes);

  // 6. Verify final DB status
  console.log('\nStep 6: Verifying final order state and assignment in database...');
  const finalOrder = await db.getOrderByCode(order.order_id);
  console.log('Final Order in DB:');
  console.log({
    order_id: finalOrder?.order_id,
    status: finalOrder?.status,
    total_amount: finalOrder?.total_amount,
    player_uid: finalOrder?.player_uid || (finalOrder?.delivery_address as any)?.player_uid,
    worker: finalOrder?.current_worker?.full_name
  });

  if (finalOrder?.status === 'DELIVERED') {
    console.log('\n================================================================');
    console.log('🎉 TELEGRAM WORKER FULL LIFECYCLE FLOW TEST PASSED SUCCESSFULLY!');
    console.log('================================================================');
  } else {
    console.error(`❌ FAIL: Expected DELIVERED but got ${finalOrder?.status}`);
    process.exit(1);
  }
}

testTelegramWorkerLifecycle()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal Telegram Worker Test Error:', err);
    process.exit(1);
  });
