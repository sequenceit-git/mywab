import { langchainAgent } from './src/lib/ai/langchain-agent';
import { db } from './src/lib/db/mock-db';

async function testButtons() {
  const phone = '+8801705785272';
  const conv = await db.getOrCreateConversation(phone, 'Test User');

  console.log('--- 1. Testing Button: btn_catalog (UC প্রাইস লিস্ট) ---');
  const res1 = await langchainAgent.processStructuredMessage({
    phone,
    messageText: 'UC price list koto',
    conversationId: conv.id
  });
  console.log('Response:', res1.text);
  console.log('Buttons:', res1.buttons?.map(b => b.title).join(' | '));

  console.log('\n--- 2. Testing Button: btn_60uc (⚡ 60 UC) ---');
  const res2 = await langchainAgent.processStructuredMessage({
    phone,
    messageText: '60 UC',
    conversationId: conv.id
  });
  console.log('Response:', res2.text);
  console.log('Buttons:', res2.buttons?.map(b => b.title).join(' | ') || 'None (correct - typing UID)');

  console.log('\n--- 3. Testing Button: btn_website (🌐 ওয়েবসাইট) ---');
  const res3 = await langchainAgent.processStructuredMessage({
    phone,
    messageText: 'Website discount link den',
    conversationId: conv.id
  });
  console.log('Response:', res3.text);
}

testButtons()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
