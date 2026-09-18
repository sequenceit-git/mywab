import { db } from '../src/lib/db';
import { stateBot } from '../src/lib/chat/state-bot';
import { GAME_CATEGORIES } from '../src/lib/chat/game-catalog';

async function runFullTestSuite() {
  console.log('🧪 Starting Comprehensive State Bot Test Suite...\n');

  console.log(`✅ Verified ${GAME_CATEGORIES.length} Game Categories in Catalog:`);
  GAME_CATEGORIES.forEach((cat, idx) => {
    console.log(`   ${idx + 1}. [${cat.id}] ${cat.emoji} ${cat.fullName} (${cat.packages.length} packages)`);
  });

  // Test 1: PUBG UID flow
  console.log('\n========================================');
  console.log('Test 1: Full PUBG Mobile UID Top-Up Flow');
  console.log('========================================');
  {
    const phone = '+8801811111111';
    const user = await db.getOrCreateUser(phone, 'PUBG Player');
    const conv = await db.getOrCreateConversation(phone, 'PUBG Player');

    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: 'hello' });
    let st = db.getSessionState(conv.id);
    if (st.step !== 'SELECTING_GAME') throw new Error('PUBG Test: Step 1 failed');

    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, buttonId: 'game_pubg_uid' });
    st = db.getSessionState(conv.id);
    if (st.step !== 'SELECTING_PACKAGE' || st.draftOrder.selectedGame !== 'pubg_uid') throw new Error('PUBG Test: Step 2 failed');

    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, listId: 'pkg_pubg_385' });
    st = db.getSessionState(conv.id);
    if (st.step !== 'COLLECTING_UID' || st.draftOrder.totalAmount !== 710) throw new Error('PUBG Test: Step 3 failed');

    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: '5123984712' });
    st = db.getSessionState(conv.id);
    if (st.step !== 'AWAITING_PAYMENT' || st.draftOrder.playerUid !== '5123984712') throw new Error('PUBG Test: Step 4 failed');

    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: 'BKASH-TRX-101' });
    st = db.getSessionState(conv.id);
    if (st.step !== 'ORDER_PLACED') throw new Error('PUBG Test: Step 5 failed');

    const orders = await db.getOrders();
    const order = orders.find(o => o.delivery_phone === phone);
    if (!order || order.total_amount !== 710 || order.player_uid !== '5123984712') throw new Error('PUBG Order mismatch');
    console.log('✅ Test 1 Passed! Created Order:', order.order_id, `(৳${order.total_amount})`);
  }

  // Test 2: Free Fire flow
  console.log('\n========================================');
  console.log('Test 2: Free Fire Diamonds Top-Up Flow');
  console.log('========================================');
  {
    const phone = '+8801822222222';
    const user = await db.getOrCreateUser(phone, 'FF Gamer');
    const conv = await db.getOrCreateConversation(phone, 'FF Gamer');

    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, buttonId: 'game_ff' });
    let st = db.getSessionState(conv.id);
    if (st.step !== 'SELECTING_PACKAGE' || st.draftOrder.selectedGame !== 'ff') throw new Error('FF Test: Step 1 failed');

    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, listId: 'pkg_ff_610' });
    st = db.getSessionState(conv.id);
    if (st.step !== 'COLLECTING_UID' || st.draftOrder.totalAmount !== 470) throw new Error('FF Test: Step 2 failed');

    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: '876543210' });
    st = db.getSessionState(conv.id);
    if (st.step !== 'AWAITING_PAYMENT' || st.draftOrder.playerUid !== '876543210') throw new Error('FF Test: Step 3 failed');

    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: 'NAGAD-9988' });
    st = db.getSessionState(conv.id);
    if (st.step !== 'ORDER_PLACED') throw new Error('FF Test: Step 4 failed');

    const orders = await db.getOrders();
    const order = orders.find(o => o.delivery_phone === phone);
    if (!order || order.total_amount !== 470 || order.player_uid !== '876543210') throw new Error('FF Order mismatch');
    console.log('✅ Test 2 Passed! Created Order:', order.order_id, `(৳${order.total_amount})`);
  }

  // Test 3: Movie/Anime Subscription flow
  console.log('\n========================================');
  console.log('Test 3: Movie/Anime Subscription Flow');
  console.log('========================================');
  {
    const phone = '+8801833333333';
    const user = await db.getOrCreateUser(phone, 'Anime Fan');
    const conv = await db.getOrCreateConversation(phone, 'Anime Fan');

    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, buttonId: 'game_movie' });
    let st = db.getSessionState(conv.id);
    if (st.step !== 'SELECTING_PACKAGE' || st.draftOrder.selectedGame !== 'movie') throw new Error('Movie Test: Step 1 failed');

    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, listId: 'pkg_sub_netflix' });
    st = db.getSessionState(conv.id);
    if (st.step !== 'COLLECTING_UID' || st.draftOrder.totalAmount !== 320) throw new Error('Movie Test: Step 2 failed');

    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: 'user@example.com' });
    st = db.getSessionState(conv.id);
    if (st.step !== 'AWAITING_PAYMENT' || st.draftOrder.playerUid !== 'user@example.com') throw new Error('Movie Test: Step 3 failed');

    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: 'ROCKET-7766' });
    st = db.getSessionState(conv.id);
    if (st.step !== 'ORDER_PLACED') throw new Error('Movie Test: Step 4 failed');

    const orders = await db.getOrders();
    const order = orders.find(o => o.delivery_phone === phone);
    if (!order || order.total_amount !== 320 || order.player_uid !== 'user@example.com') throw new Error('Movie Order mismatch');
    console.log('✅ Test 3 Passed! Created Order:', order.order_id, `(৳${order.total_amount})`);
  }

  // Test 4: eFootball Android flow
  console.log('\n========================================');
  console.log('Test 4: eFootball Android Coins Flow');
  console.log('========================================');
  {
    const phone = '+8801844444444';
    const user = await db.getOrCreateUser(phone, 'Football Gamer');
    const conv = await db.getOrCreateConversation(phone, 'Football Gamer');

    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, buttonId: 'game_efb_android' });
    let st = db.getSessionState(conv.id);
    if (st.step !== 'SELECTING_PACKAGE' || st.draftOrder.selectedGame !== 'efb_android') throw new Error('eFB Test: Step 1 failed');

    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, listId: 'pkg_efb_and_1050' });
    st = db.getSessionState(conv.id);
    if (st.step !== 'COLLECTING_UID' || st.draftOrder.totalAmount !== 1090) throw new Error('eFB Test: Step 2 failed');

    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: 'konami_id_user@gmail.com' });
    st = db.getSessionState(conv.id);
    if (st.step !== 'AWAITING_PAYMENT' || st.draftOrder.playerUid !== 'konami_id_user@gmail.com') throw new Error('eFB Test: Step 3 failed');

    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: 'BKASH-COIN-TRX' });
    st = db.getSessionState(conv.id);
    if (st.step !== 'ORDER_PLACED') throw new Error('eFB Test: Step 4 failed');

    const orders = await db.getOrders();
    const order = orders.find(o => o.delivery_phone === phone);
    if (!order || order.total_amount !== 1090) throw new Error('eFB Order mismatch');
    console.log('✅ Test 4 Passed! Created Order:', order.order_id, `(৳${order.total_amount})`);
  }

  console.log('\n🎉 ALL 4 COMPREHENSIVE TESTS PASSED SUCCESSFULLY!');
}

runFullTestSuite().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
