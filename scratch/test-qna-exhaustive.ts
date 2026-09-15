import { langchainAgent } from '../src/lib/ai/langchain-agent';
import { db } from '../src/lib/db';

interface QnATestCase {
  id: string;
  category: string;
  question: string;
  description: string;
  validate: (replyText: string, r: any) => void;
}

async function runExhaustiveQnATests() {
  console.log('================================================================');
  console.log('❓ EXHAUSTIVE Q&A CONVERSATION TEST SUITE: EVERY USE CASE');
  console.log('================================================================\n');

  const qnaCases: QnATestCase[] = [
    // 1. Greetings & Availability
    {
      id: 'QNA-1',
      category: 'Greetings & Status',
      question: 'bhai acen? line a acen?',
      description: 'Customer asks if shop is online/active',
      validate: (reply) => {
        if (!reply || reply.length < 5) throw new Error('Reply is too short or empty');
        if (!reply.includes('জি') && !reply.includes('আছি') && !reply.includes('হেল্প') && !reply.includes('সাহায্য')) {
          throw new Error(`Expected greeting confirmation, got: "${reply}"`);
        }
      }
    },
    // 2. Specific UC Package Pricing (60 UC)
    {
      id: 'QNA-2',
      category: 'Package Pricing',
      question: '60 uc koto tk?',
      description: 'Customer asks for 60 UC price',
      validate: (reply) => {
        if (!reply.includes('115') && !reply.includes('১১৫')) {
          throw new Error(`Expected 115 Tk price for 60 UC, got: "${reply}"`);
        }
      }
    },
    // 3. Specific UC Package Pricing (325 UC)
    {
      id: 'QNA-3',
      category: 'Package Pricing',
      question: '325 uc er price koto?',
      description: 'Customer asks for 325 UC price',
      validate: (reply) => {
        if (!reply.includes('600') && !reply.includes('৬০০')) {
          throw new Error(`Expected 600 Tk price for 325 UC, got: "${reply}"`);
        }
      }
    },
    // 4. Specific UC Package Pricing (385 UC [50 RP])
    {
      id: 'QNA-4',
      category: 'Package Pricing',
      question: '385 uc 50 rp koto tk lagbe?',
      description: 'Customer asks for 385 UC (50 RP) price',
      validate: (reply) => {
        if (!reply.includes('710') && !reply.includes('৭১০')) {
          throw new Error(`Expected 710 Tk price for 385 UC, got: "${reply}"`);
        }
      }
    },
    // 5. Specific UC Package Pricing (660 UC)
    {
      id: 'QNA-5',
      category: 'Package Pricing',
      question: '660 uc er rate koto?',
      description: 'Customer asks for 660 UC price',
      validate: (reply) => {
        if (!reply.includes('1150') && !reply.includes('১১৫০')) {
          throw new Error(`Expected 1150 Tk price for 660 UC, got: "${reply}"`);
        }
      }
    },
    // 6. Specific UC Package Pricing (720 UC [100 RP])
    {
      id: 'QNA-6',
      category: 'Package Pricing',
      question: '720 uc 100 rp price koto?',
      description: 'Customer asks for 720 UC price',
      validate: (reply) => {
        if (!reply.includes('1250') && !reply.includes('১২৫০')) {
          throw new Error(`Expected 1250 Tk price for 720 UC, got: "${reply}"`);
        }
      }
    },
    // 7. Non-Existent / Sub-Minimum Package Inquiry
    {
      id: 'QNA-7',
      category: 'Package Constraints',
      question: '10 uc or 20 uc dewa jabe?',
      description: 'Customer asks for non-existent 10 or 20 UC package',
      validate: (reply) => {
        if (!reply.includes('60') && !reply.includes('৬০') && !reply.includes('নেই') && !reply.includes('সর্বনিম্ন')) {
          throw new Error(`Expected minimum 60 UC clarification, got: "${reply}"`);
        }
      }
    },
    // 8. Growth Pack Pricing
    {
      id: 'QNA-8',
      category: 'Special Products',
      question: 'Growth Pack 1 er dam koto?',
      description: 'Customer asks for Growth Pack 1 price',
      validate: (reply) => {
        if (!reply.includes('150') && !reply.includes('১৫০')) {
          throw new Error(`Expected 150 Tk price for Growth Pack 1, got: "${reply}"`);
        }
      }
    },
    // 9. Prime Plus Subscription Pricing
    {
      id: 'QNA-9',
      category: 'Subscriptions',
      question: 'Prime Plus 1 month price koto?',
      description: 'Customer asks for Prime Plus 1 Month price',
      validate: (reply) => {
        if (!reply.includes('1150') && !reply.includes('১১৫০')) {
          throw new Error(`Expected 1150 Tk price for Prime Plus, got: "${reply}"`);
        }
      }
    },
    // 10. Security & Password Policy
    {
      id: 'QNA-10',
      category: 'Security & Safety',
      question: 'ID Password or Login lagbe? Safe kina?',
      description: 'Customer asks if account password is required and if it is safe',
      validate: (reply) => {
        const lower = reply.toLowerCase();
        if (!lower.includes('uid') && !reply.includes('পাসওয়ার্ড') && !reply.includes('নিরাপদ') && !reply.includes('safe')) {
          throw new Error(`Expected safety and UID-only explanation, got: "${reply}"`);
        }
      }
    },
    // 11. Delivery Timing Policy
    {
      id: 'QNA-11',
      category: 'Delivery Policy',
      question: 'Delivery dite koto somoi lagbe vai?',
      description: 'Customer asks about delivery duration',
      validate: (reply) => {
        if (!reply.includes('5-15') && !reply.includes('৫-১৫') && !reply.includes('৫ থেকে ১৫') && !reply.includes('৫–১৫') && !reply.includes('৫ মিনিট')) {
          throw new Error(`Expected 5-15 minutes delivery time, got: "${reply}"`);
        }
      }
    },
    // 12. Payment Numbers Inquiry
    {
      id: 'QNA-12',
      category: 'Payment Accounts',
      question: 'Payment number den, bKash / Nagad number ki?',
      description: 'Customer asks for official payment numbers',
      validate: (reply) => {
        if (!reply.includes('01872239597') && !reply.includes('01330719250')) {
          throw new Error(`Expected official payment numbers (01872239597 / 01330719250), got: "${reply}"`);
        }
      }
    },
    // 13. Discount & Website Promo
    {
      id: 'QNA-13',
      category: 'Discounts & Promo',
      question: 'Kono discount pabo? Kom rakhben na?',
      description: 'Customer asks for discounts',
      validate: (reply) => {
        if (!reply.includes('2%') && !reply.includes('২%') && !reply.includes('dsdukan.com') && !reply.includes('ওয়েবসাইট')) {
          throw new Error(`Expected 2% website discount promo, got: "${reply}"`);
        }
      }
    },
    // 14. How to Order / Ordering Steps
    {
      id: 'QNA-14',
      category: 'Ordering Process',
      question: 'Uc nibo vaiya kivabe kinbo?',
      description: 'Customer asks how to place an order',
      validate: (reply) => {
        const lower = reply.toLowerCase();
        if (!lower.includes('uid') && !reply.includes('আইডি') && !reply.includes('প্যাকেজ')) {
          throw new Error(`Expected ordering guidance with UID requirement, got: "${reply}"`);
        }
      }
    },
    // 15. Pure Bengali Script Q&A: ডেলিভারি ও পাসওয়ার্ড
    {
      id: 'QNA-15',
      category: 'Bengali Q&A',
      question: 'টপ-আপ করতে কি আইডি পাসওয়ার্ড দেওয়া লাগবে? ডেলিভারি পেতে কতক্ষণ লাগে?',
      description: 'Customer asks in pure Bengali script about passwords and delivery',
      validate: (reply) => {
        if (!reply.includes('UID') && !reply.includes('পাসওয়ার্ড') && !reply.includes('মিনিট') && !reply.includes('৫')) {
          throw new Error(`Expected Bengali response with UID & delivery duration, got: "${reply}"`);
        }
      }
    }
  ];

  let passed = 0;

  for (let i = 0; i < qnaCases.length; i++) {
    const tc = qnaCases[i];
    console.log(`[${i + 1}/${qnaCases.length}] [${tc.category}] ${tc.id}: "${tc.question}"`);
    console.log(`   Description: ${tc.description}`);

    const phone = `+88017${Math.floor(10000000 + Math.random() * 90000000)}`;
    const conv = await db.getOrCreateConversation(phone, `QnA User ${i + 1}`);

    try {
      const response = await langchainAgent.processStructuredMessage({
        phone,
        messageText: tc.question,
        conversationId: conv.id
      });

      console.log(`   💬 Bot Reply: "${response.text.replace(/\n/g, ' ')}"`);
      tc.validate(response.text, response);
      console.log(`   ✅ PASS\n`);
      passed++;
    } catch (err: any) {
      console.error(`   ❌ FAIL: ${err.message}\n`);
    }
  }

  // 16. Multi-Turn Q&A Transitioning smoothly to Order Flow
  console.log(`[16/16] [Flow Transition] Multi-Turn Q&A seamlessly transitioning to Top-Up Order...`);
  try {
    const flowPhone = `+88017${Math.floor(10000000 + Math.random() * 90000000)}`;
    const flowConv = await db.getOrCreateConversation(flowPhone, 'Transition User');

    // Turn 1: Question about price
    const r1 = await langchainAgent.processStructuredMessage({ phone: flowPhone, messageText: '60 UC price koto?', conversationId: flowConv.id });
    if (!r1.text.includes('115') && !r1.text.includes('১১৫')) throw new Error('Turn 1 failed to answer price');

    // Turn 2: Question about password safety
    const r2 = await langchainAgent.processStructuredMessage({ phone: flowPhone, messageText: 'Password lagbe kina?', conversationId: flowConv.id });
    if (!r2.text.includes('UID') && !r2.text.includes('পাসওয়ার্ড') && !r2.text.includes('লাগবে না')) throw new Error('Turn 2 failed to clarify password');

    // Turn 3: Customer decides to order
    const r3 = await langchainAgent.processStructuredMessage({ phone: flowPhone, messageText: 'Accha 60 UC nibo, UID: 5123456789', conversationId: flowConv.id });
    if (!r3.text.includes('115') && !r3.text.includes('01872239597') && !r3.text.includes('বিকাশ')) {
      throw new Error(`Turn 3 failed to provide payment accounts for order. Got: ${r3.text}`);
    }

    // Turn 4: Customer pays
    const r4 = await langchainAgent.processStructuredMessage({ phone: flowPhone, messageText: 'bKash a 115 tk disi, Trx: QNATRX99', conversationId: flowConv.id });
    if (!r4.createdOrder?.order_id || r4.createdOrder.total_amount !== 115) {
      throw new Error(`Turn 4 failed to create order. Got: ${JSON.stringify(r4.createdOrder)}`);
    }

    console.log(`   ✅ PASS (Order created: ${r4.createdOrder.order_id})\n`);
    passed++;
  } catch (err: any) {
    console.error(`   ❌ FAIL: ${err.message}\n`);
  }

  const total = qnaCases.length + 1;
  console.log('================================================================');
  console.log(`📊 Q&A TEST SUITE SUMMARY: ${passed}/${total} CASES PASSED`);
  console.log('================================================================');

  if (passed < total) {
    process.exit(1);
  }
}

runExhaustiveQnATests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal QnA Runner Error:', err);
    process.exit(1);
  });
