import { langchainAgent } from '../src/lib/ai/langchain-agent';
import { db } from '../src/lib/db';

async function main() {
  const phone = '8801711223399';
  const conv = await db.getOrCreateConversation(phone, 'PUBG Gamer');
  const convId = conv.id;

  console.log('========================================================');
  console.log('TURN 1: "10 uc er price koto" (Price Inquiry)');
  console.log('========================================================');
  const res1 = await langchainAgent.processStructuredMessage({
    phone,
    messageText: '10 uc er price koto',
    conversationId: convId
  });
  console.log('AI Response 1:\n', res1.text);
  console.log('Lines:', res1.text.split('\n').filter(Boolean).length);

  console.log('\n========================================================');
  console.log('TURN 2: "Ok 60 UC" (Product selection)');
  console.log('========================================================');
  await db.addMessage({
    conversationId: convId,
    sender: 'CUSTOMER',
    content: '10 uc er price koto'
  });
  await db.addMessage({
    conversationId: convId,
    sender: 'AI_AGENT',
    content: res1.text
  });

  const res2 = await langchainAgent.processStructuredMessage({
    phone,
    messageText: 'Ok 60 UC',
    conversationId: convId
  });
  console.log('AI Response 2:\n', res2.text);
  console.log('Lines:', res2.text.split('\n').filter(Boolean).length);

  console.log('\n========================================================');
  console.log('TURN 3: "5123456789" (Player UID provided)');
  console.log('========================================================');
  await db.addMessage({
    conversationId: convId,
    sender: 'CUSTOMER',
    content: 'Ok 60 UC'
  });
  await db.addMessage({
    conversationId: convId,
    sender: 'AI_AGENT',
    content: res2.text
  });

  const res3 = await langchainAgent.processStructuredMessage({
    phone,
    messageText: '5123456789',
    conversationId: convId
  });
  console.log('AI Response 3:\n', res3.text);
  console.log('Lines:', res3.text.split('\n').filter(Boolean).length);

  console.log('\n========================================================');
  console.log('TURN 4: "Bkash a disi 3dhhs6js" (Payment provided)');
  console.log('========================================================');
  await db.addMessage({
    conversationId: convId,
    sender: 'CUSTOMER',
    content: '5123456789'
  });
  await db.addMessage({
    conversationId: convId,
    sender: 'AI_AGENT',
    content: res3.text
  });

  const res4 = await langchainAgent.processStructuredMessage({
    phone,
    messageText: 'Bkash a disi 3dhhs6js',
    conversationId: convId
  });
  console.log('AI Response 4:\n', res4.text);
  console.log('Created Order:', res4.createdOrder?.order_id || 'None');
  console.log('Lines:', res4.text.split('\n').filter(Boolean).length);
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
