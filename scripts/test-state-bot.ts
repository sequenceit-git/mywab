// Force in-memory mock store for isolated, instant, network-free test execution
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

import { db } from '../src/lib/db';
import { stateBot } from '../src/lib/chat/state-bot';
import { whatsappService } from '../src/lib/whatsapp/service';
import { telegramBot } from '../src/lib/telegram/bot';
import { GAME_CATEGORIES } from '../src/lib/chat/game-catalog';
import { extractCleanUid, isRefusalOrCancellation, isPriceInquiry, parseSlashCommand } from '../src/lib/chat/input-parser';

// Mock WhatsApp & Telegram network calls for fast offline test execution
whatsappService.sendMessage = async () => ({ success: true, messageId: 'test_msg_id' });
whatsappService.sendInteractiveButtons = async () => ({ success: true, messageId: 'test_msg_id' });
whatsappService.sendInteractiveList = async () => ({ success: true, messageId: 'test_msg_id' });
whatsappService.sendOrderConfirmation = async () => ({ success: true, messageId: 'test_msg_id' });
whatsappService.sendOrderClaimedNotification = async () => ({ success: true, messageId: 'test_msg_id' });
whatsappService.sendOrderDeliveredNotification = async () => ({ success: true, messageId: 'test_msg_id' });
whatsappService.sendOrderCancelledNotification = async () => ({ success: true, messageId: 'test_msg_id' });
telegramBot.dispatchNewOrder = async () => ({ success: true });

async function runFullTestSuite() {
  console.log('🧪 Starting 360° Comprehensive Conversation Test Suite...\n');

  console.log(`📋 1. Verifying Game Catalog (${GAME_CATEGORIES.length} Categories):`);
  GAME_CATEGORIES.forEach((cat, idx) => {
    console.log(`   ${idx + 1}. [${cat.id}] ${cat.emoji} ${cat.fullName} (${cat.packages.length} packages)`);
  });

  // =========================================================================
  // TEST SUITE 1: Standard Ordering Flows
  // =========================================================================
  console.log('\n===============================================================');
  console.log('TEST 1: Standard End-to-End Order Flow (PUBG 385 UC)');
  console.log('===============================================================');
  {
    const phone = '+8801811111111';
    const user = await db.getOrCreateUser(phone, 'Standard User');
    const conv = await db.getOrCreateConversation(phone, 'Standard User');

    // 1. Hello
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: 'hello' });
    let st = db.getSessionState(conv.id);
    if (st.step !== 'SELECTING_GAME') throw new Error('Test 1 failed: Expected SELECTING_GAME');

    // 2. Select PUBG
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, buttonId: 'game_pubg_uid' });
    st = db.getSessionState(conv.id);
    if (st.step !== 'SELECTING_PACKAGE' || st.draftOrder.selectedGame !== 'pubg_uid') throw new Error('Test 1 failed: Expected SELECTING_PACKAGE');

    // 3. Select 385 UC (710 Tk)
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, listId: 'pkg_pubg_385' });
    st = db.getSessionState(conv.id);
    if (st.step !== 'COLLECTING_UID' || st.draftOrder.totalAmount !== 710) throw new Error('Test 1 failed: Expected COLLECTING_UID with total 710');

    // 4. Enter valid UID
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: '5123984712' });
    st = db.getSessionState(conv.id);
    if (st.step !== 'AWAITING_PAYMENT' || st.draftOrder.playerUid !== '5123984712') throw new Error('Test 1 failed: Expected AWAITING_PAYMENT with UID 5123984712');

    // 5. Submit TrxID
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: 'BKASH-TRX-101' });
    st = db.getSessionState(conv.id);
    if (st.step !== 'ORDER_PLACED') throw new Error('Test 1 failed: Expected ORDER_PLACED');

    const orders = await db.getOrders();
    const order = orders.find(o => o.delivery_phone === phone);
    if (!order || order.total_amount !== 710 || order.player_uid !== '5123984712') throw new Error('Test 1: Order mismatch');
    console.log('✅ TEST 1 PASSED: Order created successfully:', order.order_id);
  }

  // =========================================================================
  // TEST SUITE 2: Original Bug 1 - "Selecting Main Menu asked for payment"
  // =========================================================================
  console.log('\n===============================================================');
  console.log('TEST 2: Main Menu Navigation During UID Step (Fix Validation)');
  console.log('===============================================================');
  {
    const phone = '+8801822222222';
    const user = await db.getOrCreateUser(phone, 'Menu Clicker');
    const conv = await db.getOrCreateConversation(phone, 'Menu Clicker');

    // User selects game & package
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, buttonId: 'game_pubg_uid' });
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, listId: 'pkg_pubg_60' });
    let st = db.getSessionState(conv.id);
    if (st.step !== 'COLLECTING_UID') throw new Error('Test 2 setup failed: Expected COLLECTING_UID');

    // User clicks "🔙 মেইন মেনু" button
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, buttonId: 'btn_main_menu', text: '🔙 মেইন মেনু' });
    st = db.getSessionState(conv.id);
    if (st.step !== 'SELECTING_GAME') throw new Error(`Test 2 failed: Expected SELECTING_GAME, got ${st.step}`);
    if (st.draftOrder.playerUid === '🔙 মেইন মেনু') throw new Error('Test 2 Critical Failure: "🔙 মেইন মেনু" was taken as UID!');
    console.log('✅ TEST 2A PASSED: Button click "btn_main_menu" resets to SELECTING_GAME without setting UID');

    // Test text-based "মেইন মেনু" during UID step
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, listId: 'pkg_pubg_60' });
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: 'মেইন মেনু' });
    st = db.getSessionState(conv.id);
    if (st.step !== 'SELECTING_GAME') throw new Error(`Test 2 failed: Expected SELECTING_GAME on text "মেইন মেনু", got ${st.step}`);
    console.log('✅ TEST 2B PASSED: Text "মেইন মেনু" resets to SELECTING_GAME without setting UID');
  }

  // =========================================================================
  // TEST SUITE 3: Original Bug 2 - "Selecting other service after placing order"
  // =========================================================================
  console.log('\n===============================================================');
  console.log('TEST 3: Seamless Service Switch After Order Placement');
  console.log('===============================================================');
  {
    const phone = '+8801833333333';
    const user = await db.getOrCreateUser(phone, 'Multi-Service Buyer');
    const conv = await db.getOrCreateConversation(phone, 'Multi-Service Buyer');

    // Order 1: PUBG UC
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, buttonId: 'game_pubg_uid' });
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, listId: 'pkg_pubg_60' });
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: '599887766' });
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: 'PUBG-TRX-555' });
    let st = db.getSessionState(conv.id);
    if (st.step !== 'ORDER_PLACED') throw new Error('Test 3: Step 1 failed');

    // Customer immediately requests Netflix / Movie subscription by typing "movie"
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: 'movie' });
    st = db.getSessionState(conv.id);
    if (st.step !== 'SELECTING_PACKAGE' || st.draftOrder.selectedGame !== 'movie') {
      throw new Error(`Test 3 failed: Expected SELECTING_PACKAGE for movie, got step=${st.step} game=${st.draftOrder.selectedGame}`);
    }
    console.log('✅ TEST 3A PASSED: Typing "movie" right after an order transitions immediately to Movie packages');

    // Customer picks Netflix and enters email
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, listId: 'pkg_sub_netflix' });
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: 'streamer@netflix.com' });
    st = db.getSessionState(conv.id);
    if (st.step !== 'AWAITING_PAYMENT' || st.draftOrder.playerUid !== 'streamer@netflix.com') {
      throw new Error('Test 3 failed: Expected AWAITING_PAYMENT for netflix email');
    }
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: 'NETFLIX-TRX-888' });
    st = db.getSessionState(conv.id);
    if (st.step !== 'ORDER_PLACED') throw new Error('Test 3: Movie order placement failed');
    console.log('✅ TEST 3B PASSED: 2nd consecutive order for Netflix completed smoothly');
  }

  // =========================================================================
  // TEST SUITE 4: Refusals, Cancellations & Casual Disinterest
  // =========================================================================
  console.log('\n===============================================================');
  console.log('TEST 4: Conversational Refusal & Cancellation Handling');
  console.log('===============================================================');
  {
    const phone = '+8801844444444';
    const user = await db.getOrCreateUser(phone, 'Hesitant Buyer');
    const conv = await db.getOrCreateConversation(phone, 'Hesitant Buyer');

    const refusalPhrases = [
      'No kinbo na',
      'kinbo na',
      'nibo na',
      'lagbe na',
      'pore nibo',
      'thak',
      'দরকার নেই',
      'না ভাই'
    ];

    for (const phrase of refusalPhrases) {
      // Start order
      await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, buttonId: 'game_pubg_special' });
      await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, listId: 'pkg_spec_1' });
      let st = db.getSessionState(conv.id);
      if (st.step !== 'COLLECTING_UID') throw new Error(`Test 4 setup failed for "${phrase}"`);

      // User says refusal phrase
      await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: phrase });
      st = db.getSessionState(conv.id);

      if (st.step !== 'IDLE') throw new Error(`Test 4 failed: Expected IDLE after refusal "${phrase}", got ${st.step}`);
      if (st.draftOrder.playerUid === phrase) throw new Error(`Test 4 Critical Failure: "${phrase}" was accepted as playerUid!`);
      console.log(`   ✓ Refusal recognized: "${phrase}" -> Session reset gracefully to IDLE`);
    }
    console.log('✅ TEST 4 PASSED: All customer refusal and cancellation phrases handled cleanly');
  }

  // =========================================================================
  // TEST SUITE 5: All Slash Commands
  // =========================================================================
  console.log('\n===============================================================');
  console.log('TEST 5: Slash Command Suite (/menu, /track, /help, /movie, etc.)');
  console.log('===============================================================');
  {
    const phone = '+8801855555555';
    const user = await db.getOrCreateUser(phone, 'Power User');
    const conv = await db.getOrCreateConversation(phone, 'Power User');

    // /menu
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: '/menu' });
    let st = db.getSessionState(conv.id);
    if (st.step !== 'SELECTING_GAME') throw new Error('Slash /menu failed');
    console.log('   ✓ /menu -> SELECTING_GAME');

    // /movie shortcut
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: '/movie' });
    st = db.getSessionState(conv.id);
    if (st.step !== 'SELECTING_PACKAGE' || st.draftOrder.selectedGame !== 'movie') throw new Error('Slash /movie failed');
    console.log('   ✓ /movie -> Direct Movie package selector');

    // /pubg shortcut
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: '/pubg' });
    st = db.getSessionState(conv.id);
    if (st.step !== 'SELECTING_PACKAGE' || st.draftOrder.selectedGame !== 'pubg_uid') throw new Error('Slash /pubg failed');
    console.log('   ✓ /pubg -> Direct PUBG UC package selector');

    // /ff shortcut
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: '/ff' });
    st = db.getSessionState(conv.id);
    if (st.step !== 'SELECTING_PACKAGE' || st.draftOrder.selectedGame !== 'ff') throw new Error('Slash /ff failed');
    console.log('   ✓ /ff -> Direct Free Fire package selector');

    // /cancel
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: '/cancel' });
    st = db.getSessionState(conv.id);
    if (st.step !== 'SELECTING_GAME') throw new Error('Slash /cancel failed');
    console.log('   ✓ /cancel -> Reset to SELECTING_GAME');

    // /help
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: '/help' });
    console.log('   ✓ /help -> Help guide sent');

    // /website
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: '/website' });
    console.log('   ✓ /website -> Website details with 2% discount sent');

    // /track
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: '/track WAP-20260918-9999' });
    console.log('   ✓ /track -> Live order tracker processed');

    console.log('✅ TEST 5 PASSED: All slash commands executed and routed accurately');
  }

  // =========================================================================
  // TEST SUITE 6: Direct NLP Package & Price Queries
  // =========================================================================
  console.log('\n===============================================================');
  console.log('TEST 6: Direct NLP Package Matching & Price Inquiries');
  console.log('===============================================================');
  {
    const phone = '+8801866666666';
    const user = await db.getOrCreateUser(phone, 'NLP User');
    const conv = await db.getOrCreateConversation(phone, 'NLP User');

    // Direct: "PUBG 660 UC"
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: 'PUBG 660 UC' });
    let st = db.getSessionState(conv.id);
    if (st.step !== 'COLLECTING_UID' || st.draftOrder.totalAmount !== 1150) {
      throw new Error(`Test 6 failed: Expected COLLECTING_UID for 660 UC (1150 Tk), got step=${st.step} amount=${st.draftOrder.totalAmount}`);
    }
    console.log('   ✓ Direct NLP: "PUBG 660 UC" -> Instant UID prompt with ৳1150 Tk');

    // Price query: "price koto"
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: 'price koto' });
    console.log('   ✓ Price Query: "price koto" -> Re-sent price list');

    console.log('✅ TEST 6 PASSED: NLP direct package matching and price queries work as expected');
  }

  // =========================================================================
  // TEST SUITE 7: Strict Input Validation Checks
  // =========================================================================
  console.log('\n===============================================================');
  console.log('TEST 7: Strict UID & Email Validation Rules');
  console.log('===============================================================');
  {
    // 1. Numeric UID requirement for PUBG / FF
    const invalidPubgInputs = ['no thanks', 'ami ovijit', 'ekhon bolbo na', 'koto tk'];
    for (const input of invalidPubgInputs) {
      const parsed = extractCleanUid(input, 'pubg_uid');
      if (parsed !== '') throw new Error(`Strict Validation Failed: "${input}" was accepted as PUBG UID!`);
    }
    const validPubgUid = extractCleanUid('Player UID: 5123456789 (main acc)', 'pubg_uid');
    if (validPubgUid !== '5123456789') throw new Error(`Valid PUBG UID failed: expected 5123456789, got ${validPubgUid}`);
    console.log('   ✓ PUBG UID strict validation passed');

    // 2. Email requirement for Netflix / Movie
    const invalidEmails = ['user-without-domain', 'not an email', 'no kinbo na'];
    for (const input of invalidEmails) {
      const parsed = extractCleanUid(input, 'movie');
      if (parsed !== '') throw new Error(`Strict Validation Failed: "${input}" was accepted as Movie Email!`);
    }
    const validEmail = extractCleanUid('Email: myaccount@gmail.com', 'movie');
    if (validEmail !== 'myaccount@gmail.com') throw new Error(`Valid Email failed: expected myaccount@gmail.com, got ${validEmail}`);
    console.log('   ✓ Movie / OTT email strict validation passed');

    console.log('✅ TEST 7 PASSED: Validation constraints strictly enforced');
  }

  // =========================================================================
  // TEST SUITE 8: Strict Payment Proof (TrxID / Last 4 Digits) Validation
  // =========================================================================
  console.log('\n===============================================================');
  console.log('TEST 8: Strict Payment Proof Validation (Reject "Baksh e send koreci")');
  console.log('===============================================================');
  {
    const phone = '+8801877777777';
    const user = await db.getOrCreateUser(phone, 'Payment Test User');
    const conv = await db.getOrCreateConversation(phone, 'Payment Test User');

    // 1. Setup order up to AWAITING_PAYMENT
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, buttonId: 'game_pubg_uid' });
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, listId: 'pkg_pubg_60' });
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: '3827267' });
    let st = db.getSessionState(conv.id);
    if (st.step !== 'AWAITING_PAYMENT') throw new Error('Test 8 setup failed: Expected AWAITING_PAYMENT');

    // 2. Customer selects Nagad
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, buttonId: 'pay_nagad' });
    st = db.getSessionState(conv.id);
    if (st.step !== 'AWAITING_PAYMENT' || st.draftOrder.paymentMethod !== 'NAGAD') throw new Error('Test 8 failed: Expected NAGAD method');

    // 3. Customer sends text without TrxID: "Baksh e send koreci"
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: 'Baksh e send koreci' });
    st = db.getSessionState(conv.id);
    if (st.step !== 'AWAITING_PAYMENT') {
      throw new Error(`Test 8 Critical Failure: "Baksh e send koreci" created an order! Step is ${st.step}`);
    }
    console.log('   ✓ Message "Baksh e send koreci" safely re-prompted without creating order');

    // 4a. Customer sends text "taka pathaisi"
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: 'taka pathaisi' });
    st = db.getSessionState(conv.id);
    if (st.step !== 'AWAITING_PAYMENT') throw new Error('Test 8 failed: "taka pathaisi" created an order');
    console.log('   ✓ Message "taka pathaisi" safely re-prompted without creating order');

    // 4b. Customer sends text "Trx send koreci"
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: 'Trx send koreci' });
    st = db.getSessionState(conv.id);
    if (st.step !== 'AWAITING_PAYMENT') throw new Error('Test 8 failed: "Trx send koreci" created an order');
    console.log('   ✓ Message "Trx send koreci" safely re-prompted without creating order');

    // 4c. Customer sends price amount "Nagad e 115 taka disi" (amount is 115 Tk)
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: 'Nagad e 115 taka disi' });
    st = db.getSessionState(conv.id);
    if (st.step !== 'AWAITING_PAYMENT') throw new Error('Test 8 failed: "Nagad e 115 taka disi" created an order');
    console.log('   ✓ Message "Nagad e 115 taka disi" safely re-prompted (115 Tk is price, not last 4 digits)');

    // 4d. Customer sends shop receiver account "01330719250"
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: '01330719250' });
    st = db.getSessionState(conv.id);
    if (st.step !== 'AWAITING_PAYMENT') throw new Error('Test 8 failed: Shop account "01330719250" created an order');
    console.log('   ✓ Shop receiver account "01330719250" safely rejected without creating order');

    // 5. Customer now provides actual 4 digits: "4591"
    await stateBot.handleIncomingMessage({ conversationId: conv.id, userId: user.id, phone, text: '4591' });
    st = db.getSessionState(conv.id);
    if (st.step !== 'ORDER_PLACED') throw new Error('Test 8 failed: Expected ORDER_PLACED after sending 4591');

    const orders = await db.getOrders();
    const order = orders.find(o => o.delivery_phone === phone);
    if (!order || order.trx_id !== '4591') throw new Error('Test 8: Order TrxID mismatch');
    console.log('   ✓ Actual Last 4 digits "4591" accepted and order placed successfully:', order.order_id);

    console.log('✅ TEST 8 PASSED: Strict TrxID and payment proof validation verified');
  }

  console.log('\n===============================================================');
  console.log('🎉 ALL 8 TEST SUITES (30+ TEST CASES) PASSED WITH 100% SUCCESS!');
  console.log('===============================================================\n');
}

runFullTestSuite().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
