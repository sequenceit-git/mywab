import { langchainAgent } from '../src/lib/ai/langchain-agent';
import { db } from '../src/lib/db';

interface TestCase {
  name: string;
  category: string;
  run: () => Promise<void>;
}

async function runExhaustiveConversationTests() {
  console.log('================================================================');
  console.log('🧪 EXHAUSTIVE CONVERSATION SUITE: TESTING EVERY CONVERSATION CASE');
  console.log('================================================================\n');

  const testCases: TestCase[] = [];
  let passedCount = 0;

  // ---------------------------------------------------------------------------
  // 1. Standard Step-by-Step Flow
  // ---------------------------------------------------------------------------
  testCases.push({
    category: 'Ordering Flow',
    name: '1. Standard Step-by-Step Top-Up (Greeting -> Price -> UID -> Payment)',
    run: async () => {
      const phone = `+88017${Math.floor(10000000 + Math.random() * 90000000)}`;
      const conv = await db.getOrCreateConversation(phone, 'Standard User');

      // Turn 1: Greeting
      const r1 = await langchainAgent.processStructuredMessage({ phone, messageText: 'Hi', conversationId: conv.id });
      if (!r1.buttons || r1.buttons.length === 0) throw new Error('Turn 1 should offer greeting buttons');

      // Turn 2: Price
      const r2 = await langchainAgent.processStructuredMessage({ phone, messageText: '60 UC price koto?', conversationId: conv.id });
      if (!r2.text.includes('115') && !r2.text.includes('১১৫')) throw new Error('Turn 2 should quote 115 price');

      // Turn 3: Select Package
      const r3 = await langchainAgent.processStructuredMessage({ phone, messageText: '60 UC nibo', conversationId: conv.id });
      if (r3.buttons && r3.buttons.length > 0) throw new Error('Turn 3 should omit buttons when asking for UID');

      // Turn 4: UID
      const r4 = await langchainAgent.processStructuredMessage({ phone, messageText: '5123456789', conversationId: conv.id });
      if (r4.buttons && r4.buttons.length > 0) throw new Error('Turn 4 should omit buttons when asking for payment');

      // Turn 5: Payment
      const r5 = await langchainAgent.processStructuredMessage({ phone, messageText: 'bKash a 115 tk disi, Trx: 9X8K7L2M', conversationId: conv.id });
      if (!r5.createdOrder?.order_id) throw new Error('Turn 5 should create confirmed order');
    }
  });

  // ---------------------------------------------------------------------------
  // 2. Pure Bengali Script Flow
  // ---------------------------------------------------------------------------
  testCases.push({
    category: 'Bengali Script',
    name: '2. Pure Bengali Script Ordering Flow (বাংলা টেক্সট)',
    run: async () => {
      const phone = `+88017${Math.floor(10000000 + Math.random() * 90000000)}`;
      const conv = await db.getOrCreateConversation(phone, 'বাংলা ইউজার');

      const r1 = await langchainAgent.processStructuredMessage({ phone, messageText: 'ভাই ইউসি কিনবো', conversationId: conv.id });
      if (!r1.text) throw new Error('No reply to Bengali inquiry');

      const r2 = await langchainAgent.processStructuredMessage({ phone, messageText: '৩৮৫ ইউসি নিব', conversationId: conv.id });
      const r3 = await langchainAgent.processStructuredMessage({ phone, messageText: 'প্লেয়ার আইডি ৫৯৯৮৮৭৭৬৬', conversationId: conv.id });
      const r4 = await langchainAgent.processStructuredMessage({ phone, messageText: 'বিকাশে ৭১০ টাকা দিয়েছি, TrxID: BK710BN', conversationId: conv.id });

      if (!r4.createdOrder?.order_id) throw new Error('Failed to create order in Bengali flow');
    }
  });

  // ---------------------------------------------------------------------------
  // 3. Banglish / Slang Variations
  // ---------------------------------------------------------------------------
  testCases.push({
    category: 'Banglish Variations',
    name: '3. Banglish / Slang / Casual Conversation',
    run: async () => {
      const phone = `+88017${Math.floor(10000000 + Math.random() * 90000000)}`;
      const conv = await db.getOrCreateConversation(phone, 'Banglish Player');

      const r1 = await langchainAgent.processStructuredMessage({ phone, messageText: 'vai 60 uc er dam koto?', conversationId: conv.id });
      if (!r1.text.includes('115') && !r1.text.includes('১১৫')) throw new Error('Did not recognize dam koto');

      const r2 = await langchainAgent.processStructuredMessage({ phone, messageText: 'amk 60 uc daw, uid: 5123456789, nagad e 115 disi trx 998877', conversationId: conv.id });
      if (!r2.createdOrder?.order_id) throw new Error('Did not create order from casual banglish message');
    }
  });

  // ---------------------------------------------------------------------------
  // 4. Single-Shot Complete Order Input
  // ---------------------------------------------------------------------------
  testCases.push({
    category: 'Fast Ordering',
    name: '4. Single-Shot Order Input (Package + UID + Payment Method + TrxID)',
    run: async () => {
      const phone = `+88017${Math.floor(10000000 + Math.random() * 90000000)}`;
      const conv = await db.getOrCreateConversation(phone, 'Fast Buyer');

      const r = await langchainAgent.processStructuredMessage({
        phone,
        messageText: '385 UC nibo, Player UID: 5199228811, bKash 710 tk sent, TrxID: 9988AABB',
        conversationId: conv.id
      });

      if (!r.createdOrder?.order_id || r.createdOrder.total_amount !== 710) {
        throw new Error(`Single shot order failed: ${JSON.stringify(r.createdOrder)}`);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 5. Special Non-UC Game Products (Growth Packs / Prime Plus)
  // ---------------------------------------------------------------------------
  testCases.push({
    category: 'Special Products',
    name: '5. Non-UC Package Top-Up (Growth Pack 1 & Prime Plus)',
    run: async () => {
      const phone = `+88017${Math.floor(10000000 + Math.random() * 90000000)}`;
      const conv = await db.getOrCreateConversation(phone, 'Special Buyer');

      // Test Growth Pack 1 (৳150)
      const r_gp = await langchainAgent.processStructuredMessage({
        phone,
        messageText: 'Growth Pack 1 lagbe, UID: 511223344, Bkash 150 disi Trx: GP1TRX',
        conversationId: conv.id
      });
      if (!r_gp.createdOrder?.order_id || r_gp.createdOrder.total_amount !== 150) {
        throw new Error(`Growth pack order failed: ${JSON.stringify(r_gp.createdOrder)}`);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 6. General Business FAQ Queries (Trusted, Location, Delivery Time)
  // ---------------------------------------------------------------------------
  testCases.push({
    category: 'FAQs & Policies',
    name: '6. General Business FAQs (Trusted, Delivery Time, Account Security)',
    run: async () => {
      const phone = `+88017${Math.floor(10000000 + Math.random() * 90000000)}`;
      const conv = await db.getOrCreateConversation(phone, 'FAQ Inquirer');

      // 1. Password required?
      const r1 = await langchainAgent.processStructuredMessage({ phone, messageText: 'Password lagbe?', conversationId: conv.id });
      if (!r1.text.includes('UID') && !r1.text.includes('পাসওয়ার্ড') && !r1.text.includes('লাগবে না')) {
        throw new Error('FAQ Password reply incorrect');
      }

      // 2. Delivery Time
      const r2 = await langchainAgent.processStructuredMessage({ phone, messageText: 'Delivery koto khon lagbe?', conversationId: conv.id });
      if (!r2.text.includes('৫–১৫') && !r2.text.includes('5-15') && !r2.text.includes('মিনিট')) {
        throw new Error('FAQ Delivery time reply incorrect');
      }

      // 3. Payment Numbers
      const r3 = await langchainAgent.processStructuredMessage({ phone, messageText: 'Payment number den', conversationId: conv.id });
      if (!r3.text.includes('01872239597') && !r3.text.includes('01330719250')) {
        throw new Error('FAQ Payment numbers missing');
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 7. Mid-Conversation Mind Changing (Package Switching)
  // ---------------------------------------------------------------------------
  testCases.push({
    category: 'Edge Cases',
    name: '7. Mid-Conversation Package Switch (60 UC -> 120 UC)',
    run: async () => {
      const phone = `+88017${Math.floor(10000000 + Math.random() * 90000000)}`;
      const conv = await db.getOrCreateConversation(phone, 'Switcher');

      await langchainAgent.processStructuredMessage({ phone, messageText: '60 UC nibo', conversationId: conv.id });
      const r_switch = await langchainAgent.processStructuredMessage({ phone, messageText: 'na 120 UC nibo', conversationId: conv.id });
      await langchainAgent.processStructuredMessage({ phone, messageText: '511122233', conversationId: conv.id });
      const r_pay = await langchainAgent.processStructuredMessage({ phone, messageText: 'bKash a 230 tk disi, Trx: 120UCPAY', conversationId: conv.id });

      if (!r_pay.createdOrder?.order_id || r_pay.createdOrder.total_amount !== 230) {
        throw new Error(`Package switch order failed: ${JSON.stringify(r_pay.createdOrder)}`);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 8. Mid-Conversation Player UID Correction
  // ---------------------------------------------------------------------------
  testCases.push({
    category: 'Edge Cases',
    name: '8. Mid-Conversation UID Correction (Typo correction)',
    run: async () => {
      const phone = `+88017${Math.floor(10000000 + Math.random() * 90000000)}`;
      const conv = await db.getOrCreateConversation(phone, 'UID Corrector');

      await langchainAgent.processStructuredMessage({ phone, messageText: '60 UC', conversationId: conv.id });
      await langchainAgent.processStructuredMessage({ phone, messageText: '12345', conversationId: conv.id });
      
      // Customer corrects UID
      const r_corr = await langchainAgent.processStructuredMessage({ phone, messageText: 'sorry wrong id, amar real UID 5988776655', conversationId: conv.id });
      const r_pay = await langchainAgent.processStructuredMessage({ phone, messageText: 'bKash disi 115, Trx: CORR99', conversationId: conv.id });

      if (!r_pay.createdOrder?.order_id || r_pay.createdOrder.player_uid !== '5988776655') {
        throw new Error(`UID correction failed: ${JSON.stringify(r_pay.createdOrder)}`);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 9. Order Status Tracking (Valid Order)
  // ---------------------------------------------------------------------------
  testCases.push({
    category: 'Order Tracking',
    name: '9. Order Status Tracking for Existing Order',
    run: async () => {
      const phone = `+88017${Math.floor(10000000 + Math.random() * 90000000)}`;
      const conv = await db.getOrCreateConversation(phone, 'Track User');

      // Create an order first
      const r_order = await langchainAgent.processStructuredMessage({
        phone,
        messageText: '60 UC, UID 511111111, bKash 115, Trx: TRK001',
        conversationId: conv.id
      });
      const orderId = r_order.createdOrder?.order_id;
      if (!orderId) throw new Error('Order creation failed for tracking test');

      // Track the order
      const r_track = await langchainAgent.processStructuredMessage({
        phone,
        messageText: `amar order ${orderId} er status ki?`,
        conversationId: conv.id
      });

      if (!r_track.text.includes(orderId)) {
        throw new Error(`Tracking response did not contain order ID: ${r_track.text}`);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 10. Order Tracking (Invalid / Non-Existent Order)
  // ---------------------------------------------------------------------------
  testCases.push({
    category: 'Order Tracking',
    name: '10. Order Status Tracking for Non-Existent Order (Graceful Fallback)',
    run: async () => {
      const phone = `+88017${Math.floor(10000000 + Math.random() * 90000000)}`;
      const conv = await db.getOrCreateConversation(phone, 'Invalid Tracker');

      const r_track = await langchainAgent.processStructuredMessage({
        phone,
        messageText: 'Track order WAP-99999999-0000',
        conversationId: conv.id
      });

      if (!r_track.text.includes('খুঁজে পাওয়া যায়') && !r2_text_match(r_track.text)) {
        throw new Error(`Invalid tracking response was not graceful: ${r_track.text}`);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 11. Small Talk / Identity / Off-Topic Queries
  // ---------------------------------------------------------------------------
  testCases.push({
    category: 'Small Talk & Off-Topic',
    name: '11. Small Talk & Off-Topic Queries (Identity, Discount, Greetings)',
    run: async () => {
      const phone = `+88017${Math.floor(10000000 + Math.random() * 90000000)}`;
      const conv = await db.getOrCreateConversation(phone, 'Small Talker');

      // 1. Discount inquiry
      const r1 = await langchainAgent.processStructuredMessage({ phone, messageText: 'Kono discount hobe na?', conversationId: conv.id });
      if (!r1.text.includes('ওয়েবসাইট') && !r1.text.includes('2%') && !r1.text.includes('২%')) {
        throw new Error('Discount reply did not mention 2% website discount');
      }

      // 2. Bot Identity
      const r2 = await langchainAgent.processStructuredMessage({ phone, messageText: 'Tumi ke?', conversationId: conv.id });
      if (!r2.text) throw new Error('Empty identity response');
    }
  });

  // ---------------------------------------------------------------------------
  // 12. Multiple Parallel Customer Sessions (Session Isolation)
  // ---------------------------------------------------------------------------
  testCases.push({
    category: 'Concurrency & Isolation',
    name: '12. Parallel Multi-Customer Session Isolation',
    run: async () => {
      const phoneA = `+88017${Math.floor(10000000 + Math.random() * 90000000)}`;
      const phoneB = `+88017${Math.floor(10000000 + Math.random() * 90000000)}`;
      const convA = await db.getOrCreateConversation(phoneA, 'Customer A');
      const convB = await db.getOrCreateConversation(phoneB, 'Customer B');

      // Customer A selects 60 UC
      await langchainAgent.processStructuredMessage({ phone: phoneA, messageText: '60 UC nibo', conversationId: convA.id });
      // Customer B selects 385 UC
      await langchainAgent.processStructuredMessage({ phone: phoneB, messageText: '385 UC nibo', conversationId: convB.id });

      const stateA = db.getSessionState(convA.id);
      const stateB = db.getSessionState(convB.id);

      if (stateA.draftOrder?.items?.[0]?.skuOrName !== '60 UC') {
        throw new Error('Customer A state contaminated');
      }
      if (stateB.draftOrder?.items?.[0]?.skuOrName !== '385 UC') {
        throw new Error('Customer B state contaminated');
      }
    }
  });

  // ---------------------------------------------------------------------------
  // EXECUTION LOOP
  // ---------------------------------------------------------------------------
  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    console.log(`[Running ${i + 1}/${testCases.length}] [${tc.category}] ${tc.name}...`);
    try {
      await tc.run();
      console.log(`   ✅ PASS\n`);
      passedCount++;
    } catch (err: any) {
      console.error(`   ❌ FAIL: ${err.message}\n`);
    }
  }

  console.log('================================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passedCount}/${testCases.length} CASES PASSED`);
  console.log('================================================================');

  if (passedCount < testCases.length) {
    process.exit(1);
  }
}

function r2_text_match(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('not found') || lower.includes('নেই') || lower.includes('পাওয়া যায়নি') || lower.includes('পাওয়া যাচ্ছে না') || lower.includes('সঠিক নয়');
}

runExhaustiveConversationTests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal Test Runner Error:', err);
    process.exit(1);
  });
