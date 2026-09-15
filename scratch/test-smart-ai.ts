import { langchainAgent } from '../src/lib/ai/langchain-agent';
import { db } from '../src/lib/db';

async function main() {
  const phone = '+8801711998877';
  const conv = await db.getOrCreateConversation(phone, 'PUBG Player');
  const convId = conv.id;

  console.log('========================================================');
  console.log('TURN 1: "Price list dan" (Price List Request)');
  console.log('========================================================');
  const res1 = await langchainAgent.processStructuredMessage({
    phone,
    messageText: 'Price list dan',
    conversationId: convId
  });
  console.log('AI Response 1:\n', res1.text);

  console.log('\n========================================================');
  console.log('TURN 2: "60 UC nibo" (Package Selection)');
  console.log('========================================================');
  await db.addMessage(convId, 'CUSTOMER', 'Price list dan');
  await db.addMessage(convId, 'BOT', res1.text);

  const res2 = await langchainAgent.processStructuredMessage({
    phone,
    messageText: '60 UC nibo',
    conversationId: convId
  });
  console.log('AI Response 2:\n', res2.text);

  console.log('\n========================================================');
  console.log('TURN 3: "5123456789" (Player UID provided)');
  console.log('========================================================');
  await db.addMessage(convId, 'CUSTOMER', '60 UC nibo');
  await db.addMessage(convId, 'BOT', res2.text);

  const res3 = await langchainAgent.processStructuredMessage({
    phone,
    messageText: '5123456789',
    conversationId: convId
  });
  console.log('AI Response 3:\n', res3.text);

  console.log('\n========================================================');
  console.log('TURN 4: "Bkash a disi 3dhhs6js" (TrxID provided -> Order Create)');
  console.log('========================================================');
  await db.addMessage(convId, 'CUSTOMER', '5123456789');
  await db.addMessage(convId, 'BOT', res3.text);

  const res4 = await langchainAgent.processStructuredMessage({
    phone,
    messageText: 'Bkash a disi 3dhhs6js',
    conversationId: convId
  });
  console.log('AI Response 4:\n', res4.text);
  console.log('Created Order ID:', res4.createdOrder?.order_id || 'Created via tool');

  console.log('\n========================================================');
  console.log('TURN 5: English Query "Hi, do I need to give password?"');
  console.log('========================================================');
  const englishPhone = '+8801722334455';
  const englishConv = await db.getOrCreateConversation(englishPhone, 'English Gamer');
  const res5 = await langchainAgent.processStructuredMessage({
    phone: englishPhone,
    messageText: 'Hi, do I need to give password for top up?',
    conversationId: englishConv.id
  });
  console.log('AI Response 5 (English):\n', res5.text);
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
