import { db } from '@/lib/db';
import { WhatsAppButton } from '@/lib/whatsapp/service';
import { createOrderTool } from './tools';

export interface StructuredAgentResponse {
  text: string;
  buttons?: WhatsAppButton[];
  createdOrder?: any;
}

export async function fallbackEngineStructured(params: {
  phone: string;
  messageText: string;
  conversationId: string;
}): Promise<StructuredAgentResponse> {
  const { phone, messageText, conversationId } = params;
  const lower = messageText.toLowerCase().trim();
  const sessionState = db.getSessionState(conversationId);
  const draft = sessionState.draftOrder;

  // 1. Dynamic Catalog Rates
  const allProducts = await db.getProducts();
  const dynamicRateMap: Record<string, number> = {};
  for (const p of allProducts) {
    if (p.price > 0) {
      const numMatch = p.name_en.match(/\d+/);
      if (numMatch) {
        dynamicRateMap[numMatch[0]] = p.price;
      }
    }
  }

  const getPrice = (uc: string, fallback: number) => dynamicRateMap[uc] || fallback;

  // 2. Greetings
  if (['hi', 'hello', 'hlw', 'hey', 'bhai acen', 'vai', 'line a acen', 'ভাই আছেন', 'হ্যালো', 'হাই'].some(g => lower === g || lower.startsWith(g))) {
    const text = 
`👋 আসসালামু আলাইকুম! **DS Dukan**-এ আপনাকে স্বাগতম। 🎮✨

আমরা PUBG Mobile UC, Growth Pack এবং Prime Subscription টপ-আপ সেবা প্রদান করি।
⚡ ডেলিভারি সময়: মাত্র ৫–১৫ মিনিট (শুধুমাত্র Player UID প্রয়োজন)।
🌐 ওয়েবসাইটে সরাসরি কিনতে ভিজিট করুন: https://www.dsdukan.com/# (পাবেন ২% ইনস্ট্যান্ট ডিসকাউন্ট!)

নিচের বাটন চেপে বা আপনার কাঙ্ক্ষিত প্যাকেজটি লিখে জানান:`;

    const buttons: WhatsAppButton[] = [
      { id: 'btn_catalog', title: '💎 UC প্রাইস লিস্ট' },
      { id: 'btn_track', title: '📦 অর্ডার ট্র্যাক' },
      { id: 'btn_website', title: '🌐 ওয়েবসাইট ২% ছাড়' }
    ];

    return { text, buttons };
  }

  // 3. Pricing / Catalog Inquiries
  if (lower.includes('uc list') || lower.includes('price') || lower.includes('dam koto') || lower.includes('rate') || lower.includes('দাম') || lower.includes('প্রাইস') || lower.includes('কত টাকা')) {
    const text = 
`✅ *NEW UPDATED PUBG UC & PACKAGE LIST (DS Dukan)*:

• 60 UC : ৳${getPrice('60', 115)} BDT
• 120 UC : ৳${getPrice('120', 230)} BDT
• 180 UC : ৳${getPrice('180', 340)} BDT
• 325 UC : ৳${getPrice('325', 600)} BDT
• 385 UC [50 RP] : ৳${getPrice('385', 710)} BDT
• 660 UC : ৳${getPrice('660', 1150)} BDT
• 720 UC [100 RP] : ৳${getPrice('720', 1250)} BDT
• 1045 UC : ৳${getPrice('1045', 1850)} BDT
• 1800/3850/8100 UC : লাইভ রেট জানতে ইনবক্স করুন

🎮 *GROWTH PACK:*
• GP 1 : ৳${allProducts.find(p => p.sku === 'PUBG-GP-1')?.price || 150} | GP 2 : ৳${allProducts.find(p => p.sku === 'PUBG-GP-2')?.price || 390} | GP 3 : ৳${allProducts.find(p => p.sku === 'PUBG-GP-3')?.price || 590}

👑 *PRIME SUBSCRIPTION:*
• Prime (1M) : ৳${allProducts.find(p => p.sku === 'PUBG-PRIME-1M')?.price || 150} | Prime Plus (1M) : ৳${allProducts.find(p => p.sku === 'PUBG-PRIMEPLUS-1M')?.price || 1150}

📌 *কোনো লগইন বা পাসওয়ার্ড লাগবে না, শুধুমাত্র Player UID প্রয়োজন।*
🎁 ওয়েবসাইট (https://www.dsdukan.com/#) থেকে কিনলে পাচ্ছেন ২% অটো ডিসকাউন্ট!`;

    const buttons: WhatsAppButton[] = [
      { id: 'btn_order_60', title: `⚡ 60 UC (৳${getPrice('60', 115)})` },
      { id: 'btn_order_385', title: `👑 385 UC (৳${getPrice('385', 710)})` },
      { id: 'btn_website', title: '🌐 ওয়েবসাইট ২% ছাড়' }
    ];

    return { text, buttons };
  }

  // 4. Order Affirmation & Placement
  if (draft.playerUid && draft.trxId && (sessionState.step === 'AWAITING_CONFIRMATION' || sessionState.step === 'AWAITING_PAYMENT')) {
    const targetItems = draft.items && draft.items.length > 0 ? draft.items : [{ skuOrName: '60 UC', quantity: 1 }];
    const toolResultRaw = await createOrderTool.invoke({
      customerPhone: draft.customerPhone || phone,
      customerName: draft.customerName || 'PUBG Player',
      playerUid: draft.playerUid,
      trxId: draft.trxId,
      paymentMethod: draft.paymentMethod || 'bKash/Nagad/Rocket',
      items: targetItems,
      customerNotes: draft.customerNotes,
      conversationId
    });

    const res = JSON.parse(toolResultRaw);
    if (res.success) {
      const text = 
`🎉 *টপ-আপ অর্ডার সফলভাবে গ্রহণ করা হয়েছে!*

📦 *Order ID:* \`${res.order_id}\`
🎮 *Player UID:* \`${res.player_uid}\`
💎 *প্যাকেজ:* ${targetItems.map(i => `${i.skuOrName} x${i.quantity}`).join(', ')}
💰 *মোট মূল্য:* ৳${res.total_amount}
💳 *পেমেন্ট:* ${res.payment_method} (TrxID: \`${res.trx_id}\`)
⚡ *ডেলিভারি সময়:* ৫–১৫ মিনিট

আমাদের টপ-আপ টিম খুব দ্রুত আপনার আইডিতে ইউসি পাঠিয়ে দেবে! 🚀`;

      const buttons: WhatsAppButton[] = [
        { id: `track:${res.order_id}`, title: '📦 অর্ডার ট্র্যাক' },
        { id: 'btn_catalog', title: '💎 UC প্রাইস লিস্ট' },
        { id: 'btn_support', title: '👤 কাস্টমার কেয়ার' }
      ];

      return { text, buttons };
    }
  }

  // 5. Default Guidance
  const text = 
`🎮 **DS Dukan PUBG Top-Up Center** ⚡

ইউসি কিনতে আপনার কাঙ্ক্ষিত প্যাকেজ (যেমন: 60 UC, 385 UC) এবং Player UID লিখে জানান।
পেমেন্ট করুন আমাদের বিকাশ/রকেট (01872239597) অথবা নগদ (01330719250) নাম্বারে এবং TrxID দিন।

ডেলিভারি সময়: ৫–১৫ মিনিট। কোনো পাসওয়ার্ড বা লগইন আইডি প্রয়োজন নেই! ❤️`;

  const buttons: WhatsAppButton[] = [
    { id: 'btn_catalog', title: '💎 UC প্রাইস লিস্ট' },
    { id: 'btn_website', title: '🌐 ওয়েবসাইট ২% ছাড়' }
  ];

  return { text, buttons };
}
