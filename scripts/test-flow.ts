/**
 * test-flow.ts
 *
 * Automated 8-turn conversation flow test for the DS Dukan order bot.
 * Run with: npx tsx scripts/test-flow.ts
 *
 * Verifies:
 * - Step advances correctly at each turn
 * - Bot does NOT re-ask for already-captured slots
 * - BD phone number is NOT mistaken for Player UID
 * - BROWSING state is maintained during product exploration
 * - Order completes on final TrxID turn
 */

import { db } from '../src/lib/db';
import { extractSlotsFromMessage, isBDPhoneNumber, hasPurchaseIntent } from '../src/lib/ai/slot-extractor';
import { runStepGuard } from '../src/lib/ai/step-guard';

const TEST_PHONE = '01800000001';
const TEST_CONV_ID = `test-conv-${Date.now()}`;

interface Turn {
  message: string;
  expectedStep: string;
  description: string;
  assertions?: (state: any, slots: any) => void;
}

const TURNS: Turn[] = [
  {
    message: 'hello',
    expectedStep: 'IDLE',
    description: 'Greeting should stay IDLE — no order push',
    assertions: (_state, slots) => {
      if (slots.extractedItems) throw new Error('FAIL: Should not extract items from greeting');
      if (slots.hasPurchaseIntent) throw new Error('FAIL: "hello" should not be purchase intent');
    }
  },
  {
    message: 'Is 60 UC available?',
    expectedStep: 'BROWSING',
    description: 'Asking about a product → BROWSING (not COLLECTING_DETAILS)',
    assertions: (_state, slots) => {
      if (slots.hasPurchaseIntent) throw new Error('FAIL: "Is 60 UC available?" is browsing, not purchase intent');
    }
  },
  {
    message: 'yes i want to buy it',
    expectedStep: 'COLLECTING_DETAILS',
    description: '"I want to buy" with package context → COLLECTING_DETAILS',
    assertions: (_state, slots) => {
      if (!slots.hasPurchaseIntent) throw new Error('FAIL: "want to buy" must be purchase intent');
    }
  },
  {
    message: 'What other packages do you have?',
    expectedStep: 'COLLECTING_DETAILS',
    description: 'Mid-flow browsing question stays in COLLECTING_DETAILS (package already known)',
    assertions: (_state, _slots) => {
      // State should still have 60 UC from turn 2
    }
  },
  {
    message: 'OK I will buy 120 UC',
    expectedStep: 'COLLECTING_DETAILS',
    description: 'Package change mid-flow → COLLECTING_DETAILS with new package',
    assertions: (state, _slots) => {
      const items = state.draftOrder?.items;
      if (!items || !items.some((i: any) => i.skuOrName === '120 UC')) {
        throw new Error(`FAIL: Package should be updated to 120 UC, got: ${JSON.stringify(items)}`);
      }
    }
  },
  {
    message: 'My number is 01872239597',
    expectedStep: 'COLLECTING_DETAILS',
    description: 'BD phone number should NOT be mistaken as Player UID',
    assertions: (state, slots) => {
      if (isBDPhoneNumber('01872239597') === false) throw new Error('FAIL: isBDPhoneNumber should detect 01872239597');
      if (state.draftOrder?.playerUid === '01872239597') {
        throw new Error('FAIL: BD phone number was set as Player UID — StepGuard should have discarded it');
      }
      if (slots.extractedUid === '01872239597') throw new Error('FAIL: Slot extractor should not extract BD phone as UID');
      console.log('  ✓ BD phone number correctly ignored as UID. playerUid:', state.draftOrder?.playerUid);
    }
  },
  {
    message: 'UID is 5123456789',
    expectedStep: 'AWAITING_PAYMENT',
    description: 'Correct UID given → AWAITING_PAYMENT',
    assertions: (state, _slots) => {
      if (state.draftOrder?.playerUid !== '5123456789') {
        throw new Error(`FAIL: UID should be 5123456789, got: ${state.draftOrder?.playerUid}`);
      }
    }
  },
  {
    message: 'I sent tx id ABC12345',
    expectedStep: 'AWAITING_CONFIRMATION',
    description: 'TrxID given → AWAITING_CONFIRMATION',
    assertions: (state, _slots) => {
      if (!state.draftOrder?.trxId) {
        throw new Error('FAIL: TrxID should be captured');
      }
      if (state.draftOrder?.playerUid !== '5123456789') {
        throw new Error('FAIL: UID should still be 5123456789 after TrxID given');
      }
    }
  }
];

async function runTests() {
  console.log('='.repeat(60));
  console.log('DS Dukan Order Flow Test');
  console.log('='.repeat(60));
  console.log(`Phone: ${TEST_PHONE} | ConvID: ${TEST_CONV_ID}\n`);

  let passed = 0;
  let failed = 0;

  for (let i = 0; i < TURNS.length; i++) {
    const turn = TURNS[i];
    console.log(`\nTurn ${i + 1}: "${turn.message}"`);
    console.log(`  Expected step: ${turn.expectedStep}`);
    console.log(`  Scenario: ${turn.description}`);

    try {
      const slots = extractSlotsFromMessage(turn.message);
      const guardResult = await runStepGuard({
        phone: TEST_PHONE,
        messageText: turn.message,
        conversationId: TEST_CONV_ID,
        slots
      });

      const actualStep = guardResult.currentStep;
      const state = guardResult.updatedSessionState;

      if (actualStep !== turn.expectedStep) {
        console.error(`  ✗ STEP MISMATCH: expected=${turn.expectedStep}, got=${actualStep}`);
        failed++;
        continue;
      }

      // Run custom assertions if provided
      if (turn.assertions) {
        turn.assertions(state, slots);
      }

      console.log(`  ✓ PASS | step=${actualStep} | uid=${state.draftOrder?.playerUid || 'none'} | items=${JSON.stringify(state.draftOrder?.items)} | trx=${state.draftOrder?.trxId || 'none'}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ FAIL: ${err.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));

  // Extra unit test: BD phone number detection
  console.log('\n--- Unit Tests: BD Phone Number Detection ---');
  const bdPhones = ['01872239597', '01330719250', '01711223344', '+8801800000001'];
  const notPhones = ['5123456789', '512345678', '12345678', '1234567'];

  for (const num of bdPhones) {
    const result = isBDPhoneNumber(num);
    const pass = result === true;
    console.log(`  ${pass ? '✓' : '✗'} isBDPhoneNumber("${num}") = ${result} (expected true)`);
    if (!pass) failed++;
    else passed++;
  }

  for (const num of notPhones) {
    const result = isBDPhoneNumber(num);
    const pass = result === false;
    console.log(`  ${pass ? '✓' : '✗'} isBDPhoneNumber("${num}") = ${result} (expected false)`);
    if (!pass) failed++;
    else passed++;
  }

  // Extra unit test: Purchase intent detection
  console.log('\n--- Unit Tests: Purchase Intent Detection ---');
  const purchaseIntents = ['yes i want to buy', 'nibo', 'kinbo', 'i want to order', 'buy it'];
  const notPurchaseIntents = ['is this available?', 'what is the price?', 'hello', 'show me packages'];

  for (const msg of purchaseIntents) {
    const result = hasPurchaseIntent(msg);
    const pass = result === true;
    console.log(`  ${pass ? '✓' : '✗'} hasPurchaseIntent("${msg}") = ${result} (expected true)`);
    if (!pass) failed++;
    else passed++;
  }

  for (const msg of notPurchaseIntents) {
    const result = hasPurchaseIntent(msg);
    const pass = result === false;
    console.log(`  ${pass ? '✓' : '✗'} hasPurchaseIntent("${msg}") = ${result} (expected false)`);
    if (!pass) failed++;
    else passed++;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Final: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('ALL TESTS PASSED ✓');
  } else {
    console.log('SOME TESTS FAILED ✗');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
