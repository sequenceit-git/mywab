import { langchainAgent } from '../src/lib/ai/langchain-agent';
import { db } from '../src/lib/db';

async function main() {
  const phone = '+8801705785272';
  const userName = 'WhatsApp User';

  // 1. Get or create persistent conversation using phone
  const conv = await db.getOrCreateConversation(phone, userName);
  const convId = conv.id;
  console.log(`[Test Setup] Using persistent conversation ID: ${convId} for ${phone}`);

  console.log('\n========================================================');
  console.log('TURN 1: "Hello" (Customer Greeting)');
  console.log('========================================================');
  await db.addMessage(convId, 'CUSTOMER', 'Hello');
  const res1 = await langchainAgent.processStructuredMessage({
    phone,
    messageText: 'Hello',
    conversationId: convId
  });
  await db.addMessage(convId, 'BOT', res1.text);
  console.log('AI Response 1:\n', res1.text);
  console.log('Buttons:', res1.buttons?.map(b => b.title).join(' | '));

  console.log('\n========================================================');
  console.log('TURN 2: "Uc price koto" (Customer asks UC price)');
  console.log('========================================================');
  await db.addMessage(convId, 'CUSTOMER', 'Uc price koto');
  const res2 = await langchainAgent.processStructuredMessage({
    phone,
    messageText: 'Uc price koto',
    conversationId: convId
  });
  await db.addMessage(convId, 'BOT', res2.text);
  console.log('AI Response 2:\n', res2.text);
  console.log('Buttons:', res2.buttons?.map(b => b.title).join(' | '));

  console.log('\n========================================================');
  console.log('TURN 3: "⚡ 60 UC (৳115)" (Customer clicks/selects 60 UC)');
  console.log('========================================================');
  await db.addMessage(convId, 'CUSTOMER', '⚡ 60 UC (৳115)');
  const res3 = await langchainAgent.processStructuredMessage({
    phone,
    messageText: '⚡ 60 UC (৳115)',
    conversationId: convId
  });
  await db.addMessage(convId, 'BOT', res3.text);
  console.log('AI Response 3:\n', res3.text);
  console.log('Buttons:', res3.buttons?.map(b => b.title).join(' | '));

  const stateAfterTurn3 = db.getSessionState(convId);
  console.log('State after Turn 3 Draft Package:', stateAfterTurn3.draftOrder?.items);

  console.log('\n========================================================');
  console.log('TURN 4: "484673727" (Customer sends Player UID)');
  console.log('========================================================');
  await db.addMessage(convId, 'CUSTOMER', '484673727');
  const res4 = await langchainAgent.processStructuredMessage({
    phone,
    messageText: '484673727',
    conversationId: convId
  });
  await db.addMessage(convId, 'BOT', res4.text);
  console.log('AI Response 4:\n', res4.text);
  console.log('Buttons:', res4.buttons?.map(b => b.title).join(' | '));

  const stateAfterTurn4 = db.getSessionState(convId);
  console.log('State after Turn 4 Draft:', {
    items: stateAfterTurn4.draftOrder?.items,
    playerUid: stateAfterTurn4.draftOrder?.playerUid
  });

  // Verify inconsistency fix: AI MUST NOT ask what package user wants in Turn 4!
  const isAskingPackageAgain = res4.text.includes('কোন প্যাকেজ') || res4.text.includes('কোন UC');
  if (isAskingPackageAgain) {
    console.error('❌ FAIL: AI forgot 60 UC was selected in Turn 3 and asked for package again!');
  } else {
    console.log('✅ PASS: AI remembered 60 UC and proceeded to payment instructions with Player UID 484673727!');
  }

  console.log('\n========================================================');
  console.log('TURN 5: "Bkash a disi 3dhhs6js" (Customer sends payment)');
  console.log('========================================================');
  await db.addMessage(convId, 'CUSTOMER', 'Bkash a disi 3dhhs6js');
  const res5 = await langchainAgent.processStructuredMessage({
    phone,
    messageText: 'Bkash a disi 3dhhs6js',
    conversationId: convId
  });
  await db.addMessage(convId, 'BOT', res5.text);
  console.log('AI Response 5:\n', res5.text);
  console.log('Created Order:', res5.createdOrder?.order_id || 'None');
  console.log('Buttons:', res5.buttons?.map(b => b.title).join(' | '));
}

main().catch(err => {
  console.error('Consistency test error:', err);
  process.exit(1);
});
