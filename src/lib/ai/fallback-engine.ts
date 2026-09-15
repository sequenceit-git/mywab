import { db } from '@/lib/db';
import { WhatsAppButton } from '@/lib/whatsapp/service';
import { createOrderTool } from './tools';
import { EXACT_UC_PRICE_LIST } from './prompts';

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

  // 1. Dynamic FAQ Matching (Admin-Managed Q&As)
  const allFaqs = await db.getFAQs();
  const activeFaqs = allFaqs.filter(f => f.is_active);

  for (const faq of activeFaqs) {
    const qEnTokens = faq.question_en.toLowerCase().split(/[\/,\n|]+/).map(t => t.trim()).filter(Boolean);
    const qBnTokens = (faq.question_bn || '').toLowerCase().split(/[\/,\n|?？!！]+/).map(t => t.trim()).filter(Boolean);
    const allPatterns = [...qEnTokens, ...qBnTokens];

    const isMatch = allPatterns.some(pat => {
      if (pat.length <= 2) return lower === pat;
      return lower.includes(pat) || (lower.length > 5 && pat.includes(lower));
    });

    if (isMatch) {
      const text = faq.answer_bn || faq.answer_en;
      return { text, buttons: undefined };
    }
  }

  // 3. Greetings
  if (['hi', 'hello', 'hlw', 'hey', 'bhai acen', 'vai', 'line a acen', 'ভাই আছেন', 'হ্যালো', 'হাই'].some(g => lower === g || lower.startsWith(g))) {
    const text = 
`👋 আসসালামু আলাইকুম! **DS Dukan**-এ আপনাকে স্বাগতম। 🎮✨

আমরা PUBG Mobile UC, Growth Pack এবং Prime Subscription টপ-আপ সেবা প্রদান করি।
⚡ ডেলিভারি সময়: মাত্র ৫–১৫ মিনিট (শুধুমাত্র Player UID প্রয়োজন)।
🌐 ওয়েবসাইটে সরাসরি কিনতে ভিজিট করুন: https://www.dsdukan.com/# (পাবেন ২% ইনস্ট্যান্ট ডিসকাউন্ট!)

কী প্যাকেজ নিতে চান ভাইয়া?`;

    return { text, buttons: undefined };
  }

  // 3. Pricing / Catalog Inquiries
  if (lower.includes('uc list') || lower.includes('price') || lower.includes('dam koto') || lower.includes('rate') || lower.includes('দাম') || lower.includes('প্রাইস') || lower.includes('কত টাকা')) {
    return { text: EXACT_UC_PRICE_LIST, buttons: undefined };
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

      return { text, buttons: undefined };
    }
  }

  // 5. Default Guidance
  const text = 
`🎮 **DS Dukan PUBG Top-Up Center** ⚡

ইউসি কিনতে আপনার কাঙ্ক্ষিত প্যাকেজ (যেমন: 60 UC, 385 UC) এবং Player UID লিখে জানান।
পেমেন্ট করুন আমাদের বিকাশ/রকেট (01872239597) অথবা নগদ (01330719250) নাম্বারে এবং TrxID দিন।

ডেলিভারি সময়: ৫–১৫ মিনিট। কোনো পাসওয়ার্ড বা লগইন আইডি প্রয়োজন নেই! ❤️`;

  return { text, buttons: undefined };
}
