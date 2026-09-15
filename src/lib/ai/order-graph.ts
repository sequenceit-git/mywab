import { StateGraph, Annotation, END, START } from '@langchain/langgraph';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { db } from '@/lib/db';
import { WhatsAppButton } from '@/lib/whatsapp/service';
import { ConversationSessionState, ConversationDraftOrder } from '@/types';
import { extractSlotsFromMessage, isAffirmativePhrase, ExtractedSlots } from './slot-extractor';
import { createOrderTool, trackOrderTool, getCustomerOrdersTool } from './tools';

export type AgentIntent = 
  | 'GREETING'
  | 'CATALOG'
  | 'FAQ'
  | 'SINGLE_ORDER'
  | 'PARALLEL_ORDER'
  | 'TRACK_ORDER'
  | 'AFFIRMATION'
  | 'GENERAL_GUIDE';

export interface GraphOutput {
  text: string;
  buttons?: WhatsAppButton[];
  createdOrders?: any[];
}

export const OrderGraphAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (curr, update) => curr.concat(update),
    default: () => []
  }),
  phone: Annotation<string>(),
  conversationId: Annotation<string>(),
  messageText: Annotation<string>(),
  sessionState: Annotation<ConversationSessionState>(),
  intent: Annotation<AgentIntent>(),
  extractedSlots: Annotation<ExtractedSlots>(),
  createdOrders: Annotation<any[]>({
    reducer: (curr, update) => (update ? curr.concat(update) : curr),
    default: () => []
  }),
  buttons: Annotation<WhatsAppButton[]>({
    reducer: (_, update) => update,
    default: () => []
  }),
  finalResponseText: Annotation<string>(),
  error: Annotation<string | null>()
});

export type OrderGraphState = typeof OrderGraphAnnotation.State;

// ==========================================
// 1. SLOT EXTRACTION & STATE PERSISTENCE NODE
// ==========================================
async function extractAndSyncSlotsNode(state: OrderGraphState): Promise<Partial<OrderGraphState>> {
  const { phone, messageText, conversationId } = state;
  const currentSession = db.getSessionState(conversationId);
  const slots = extractSlotsFromMessage(messageText);
  let draft = currentSession.draftOrder;
  let parallelDrafts = currentSession.parallelDrafts || [];

  // If multi-UID detected in the message, construct parallel drafts
  if (slots.parallelOrders && slots.parallelOrders.length > 1) {
    parallelDrafts = slots.parallelOrders.map(p => ({
      items: p.items,
      playerUid: p.playerUid,
      trxId: slots.extractedTrx || draft.trxId,
      paymentMethod: slots.extractedPaymentMethod || draft.paymentMethod || 'BKASH',
      customerPhone: phone
    }));
  }

  // Single draft updates
  const updatedUid = slots.extractedUid || draft.playerUid;
  const updatedTrx = slots.extractedTrx || draft.trxId;
  const updatedPayment = slots.extractedPaymentMethod || draft.paymentMethod || 'BKASH';
  const updatedItems = slots.extractedItems && slots.extractedItems.length > 0 ? slots.extractedItems : draft.items;

  let nextStep = currentSession.step;
  if (parallelDrafts.length > 1) {
    const allHavePayment = parallelDrafts.every(p => p.trxId);
    nextStep = allHavePayment ? 'PARALLEL_CONFIRMATION' : 'AWAITING_PAYMENT';
  } else {
    const hasItems = updatedItems && updatedItems.length > 0;
    const hasUid = Boolean(updatedUid && updatedUid.trim());
    const hasPayment = Boolean(updatedTrx && updatedTrx.trim());

    if (hasItems && hasUid && hasPayment) {
      nextStep = 'AWAITING_CONFIRMATION';
    } else if (hasItems && hasUid && !hasPayment) {
      nextStep = 'AWAITING_PAYMENT';
    } else if (hasItems && !hasUid) {
      nextStep = 'COLLECTING_DETAILS';
    }
  }

  const updatedSession = db.setSessionState(conversationId, {
    step: nextStep,
    draftOrder: {
      items: updatedItems,
      playerUid: updatedUid,
      trxId: updatedTrx,
      paymentMethod: updatedPayment,
      customerPhone: phone
    },
    parallelDrafts: parallelDrafts.length > 1 ? parallelDrafts : undefined
  });

  return {
    extractedSlots: slots,
    sessionState: updatedSession
  };
}

// ==========================================
// 2. INTENT CLASSIFICATION NODE
// ==========================================
async function classifyIntentNode(state: OrderGraphState): Promise<Partial<OrderGraphState>> {
  const { messageText, sessionState, extractedSlots } = state;
  const lower = messageText.toLowerCase().trim();
  const isAffirmative = isAffirmativePhrase(messageText);

  // Check Affirmation / Fast-Path
  if (isAffirmative) {
    if (sessionState.parallelDrafts && sessionState.parallelDrafts.length > 1) {
      return { intent: 'PARALLEL_ORDER' };
    }
    if (sessionState.draftOrder?.playerUid && (sessionState.step === 'AWAITING_CONFIRMATION' || sessionState.draftOrder?.trxId)) {
      return { intent: 'SINGLE_ORDER' };
    }
  }

  // Check Multi-UID Parallel Orders
  if (extractedSlots.parallelOrders && extractedSlots.parallelOrders.length > 1) {
    return { intent: 'PARALLEL_ORDER' };
  }

  // Greetings
  if (['hi', 'hello', 'hlw', 'hey', 'bhai acen', 'vai', 'line a acen', 'ভাই আছেন', 'হ্যালো', 'হাই'].some(g => lower === g || lower.startsWith(g))) {
    return { intent: 'GREETING' };
  }

  // Order Tracking
  if (lower.includes('track') || lower.includes('status') || lower.includes('ট্র্যাক') || lower.includes('order status') || /wap-\d+/i.test(lower)) {
    return { intent: 'TRACK_ORDER' };
  }

  // Pricing & Catalog
  if (lower.includes('uc list') || lower.includes('price') || lower.includes('dam koto') || lower.includes('rate') || lower.includes('দাম') || lower.includes('প্রাইস') || lower.includes('কত টাকা')) {
    return { intent: 'CATALOG' };
  }

  // FAQs
  const allFaqs = await db.getFAQs();
  const activeFaqs = allFaqs.filter(f => f.is_active);
  const isFaqMatch = activeFaqs.some(faq => {
    const qEnTokens = faq.question_en.toLowerCase().split(/[\/,\n|]+/).map(t => t.trim()).filter(Boolean);
    const qBnTokens = (faq.question_bn || '').toLowerCase().split(/[\/,\n|?？!！]+/).map(t => t.trim()).filter(Boolean);
    const patterns = [...qEnTokens, ...qBnTokens];
    return patterns.some(pat => (pat.length <= 2 ? lower === pat : lower.includes(pat) || (lower.length > 5 && pat.includes(lower))));
  });

  if (isFaqMatch) {
    return { intent: 'FAQ' };
  }

  // Single Order Intent
  if (extractedSlots.extractedUid || extractedSlots.extractedItems || extractedSlots.extractedTrx) {
    return { intent: 'SINGLE_ORDER' };
  }

  return { intent: 'GENERAL_GUIDE' };
}

// ==========================================
// 3. CATALOG & FAQ NODE
// ==========================================
async function handleCatalogAndFaqNode(state: OrderGraphState): Promise<Partial<OrderGraphState>> {
  const { intent, messageText } = state;
  const lower = messageText.toLowerCase().trim();

  // 1. FAQ lookup
  if (intent === 'FAQ') {
    const allFaqs = await db.getFAQs();
    const activeFaqs = allFaqs.filter(f => f.is_active);
    for (const faq of activeFaqs) {
      const qEnTokens = faq.question_en.toLowerCase().split(/[\/,\n|]+/).map(t => t.trim()).filter(Boolean);
      const qBnTokens = (faq.question_bn || '').toLowerCase().split(/[\/,\n|?？!！]+/).map(t => t.trim()).filter(Boolean);
      const patterns = [...qEnTokens, ...qBnTokens];
      const isMatch = patterns.some(pat => (pat.length <= 2 ? lower === pat : lower.includes(pat) || (lower.length > 5 && pat.includes(lower))));

      if (isMatch) {
        return {
          finalResponseText: faq.answer_bn || faq.answer_en,
          buttons: [
            { id: 'btn_catalog', title: '💎 UC প্রাইস লিস্ট' },
            { id: 'btn_website', title: '🌐 ওয়েবসাইট ২% ছাড়' }
          ]
        };
      }
    }
  }

  // 2. Dynamic Catalog lookup
  const allProducts = await db.getProducts();
  const dynamicRateMap: Record<string, number> = {};
  for (const p of allProducts) {
    if (p.price > 0) {
      const numMatch = p.name_en.match(/\d+/);
      if (numMatch) dynamicRateMap[numMatch[0]] = p.price;
    }
  }
  const getPrice = (uc: string, fallback: number) => dynamicRateMap[uc] || fallback;

  if (intent === 'GREETING') {
    const text = 
`👋 আসসালামু আলাইকুম! **DS Dukan**-এ আপনাকে স্বাগতম। 🎮✨

আমরা PUBG Mobile UC, Growth Pack এবং Prime Subscription টপ-আপ সেবা প্রদান করি।
⚡ ডেলিভারি সময়: মাত্র ৫–১৫ মিনিট (শুধুমাত্র Player UID প্রয়োজন)।
🌐 ওয়েবসাইটে সরাসরি কিনতে ভিজিট করুন: https://www.dsdukan.com/# (পাবেন ২% ইনস্ট্যান্ট ডিসকাউন্ট!)

নিচের বাটন চেপে বা আপনার কাঙ্ক্ষিত প্যাকেজ ও UID লিখে জানান:`;

    return {
      finalResponseText: text,
      buttons: [
        { id: 'btn_catalog', title: '💎 UC প্রাইস লিস্ট' },
        { id: 'btn_track', title: '📦 অর্ডার ট্র্যাক' },
        { id: 'btn_website', title: '🌐 ওয়েবসাইট ২% ছাড়' }
      ]
    };
  }

  // Default Catalog Response
  const catalogText = 
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

  return {
    finalResponseText: catalogText,
    buttons: [
      { id: 'btn_order_60', title: `⚡ 60 UC (৳${getPrice('60', 115)})` },
      { id: 'btn_order_385', title: `👑 385 UC (৳${getPrice('385', 710)})` },
      { id: 'btn_website', title: '🌐 ওয়েবসাইট ২% ছাড়' }
    ]
  };
}

// ==========================================
// 4. SINGLE ORDER EXECUTION NODE
// ==========================================
async function handleSingleOrderNode(state: OrderGraphState): Promise<Partial<OrderGraphState>> {
  const { phone, conversationId, sessionState, messageText } = state;
  const draft = sessionState.draftOrder;
  const isAffirmative = isAffirmativePhrase(messageText);

  const hasUid = Boolean(draft.playerUid && draft.playerUid.trim());
  const hasPayment = Boolean(draft.trxId && draft.trxId.trim());
  const targetItems = draft.items && draft.items.length > 0 ? draft.items : [{ skuOrName: '60 UC', quantity: 1 }];

  // 1. Missing Player UID
  if (!hasUid) {
    const text = 
`🎮 *আপনার Player UID প্রদান করুন*

আপনি নির্বাচন করেছেন: *${targetItems.map(i => `${i.skuOrName} x${i.quantity}`).join(', ')}*
টপ-আপ সম্পন্ন করতে অনুগ্রহ করে আপনার সঠিক **Player UID** (যেমন: \`5123456789\`) লিখে পাঠান।`;
    return {
      finalResponseText: text,
      buttons: [{ id: 'btn_catalog', title: '💎 UC প্রাইস লিস্ট' }]
    };
  }

  // 2. Missing Payment
  if (!hasPayment) {
    const text = 
`💳 *পেমেন্ট নির্দেশিকা (DS Dukan Top-Up)*

🎮 *Player UID:* \`${draft.playerUid}\`
💎 *প্যাকেজ:* ${targetItems.map(i => `${i.skuOrName} x${i.quantity}`).join(', ')}

অনুগ্রহ করে নিচের যে কোনো একটি নাম্বারে টাকা পাঠিয়ে **TrxID** বা লাস্ট ৪ সংখ্যা দিন:
• **bKash (Personal):** \`01872239597\`
• **Rocket (Personal):** \`01872239597\`
• **Nagad (Personal):** \`01330719250\``;
    return {
      finalResponseText: text,
      buttons: [
        { id: 'btn_website', title: '🌐 ওয়েবসাইট ২% ছাড়' }
      ]
    };
  }

  // 3. Ready for Execution (Atomic DB creation + Telegram group dispatch)
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

    return {
      finalResponseText: text,
      createdOrders: [res],
      buttons: [
        { id: `track:${res.order_id}`, title: '📦 অর্ডার ট্র্যাক' },
        { id: 'btn_catalog', title: '💎 UC প্রাইস লিস্ট' },
        { id: 'btn_website', title: '🌐 ওয়েবসাইট ২% ছাড়' }
      ]
    };
  }

  return {
    finalResponseText: `⚠️ অর্ডার তৈরিতে ত্রুটি: ${res.error || 'অনুগ্রহ করে আবার চেষ্টা করুন'}`,
    buttons: [{ id: 'btn_catalog', title: '💎 UC প্রাইস লিস্ট' }]
  };
}

// ==========================================
// 5. PARALLEL / MULTI-UID ORDER EXECUTION NODE
// ==========================================
async function handleParallelOrderNode(state: OrderGraphState): Promise<Partial<OrderGraphState>> {
  const { phone, conversationId, sessionState, messageText } = state;
  const parallelDrafts = sessionState.parallelDrafts || [];
  const isAffirmative = isAffirmativePhrase(messageText);

  if (parallelDrafts.length < 2) {
    return handleSingleOrderNode(state);
  }

  // Check if all drafts have TrxID
  const hasPayment = parallelDrafts.every(d => d.trxId && d.trxId.trim());

  if (!hasPayment) {
    const subList = parallelDrafts
      .map((d, i) => `${i + 1}. 🎮 UID: \`${d.playerUid}\` ➔ ${d.items.map(it => `${it.skuOrName} x${it.quantity}`).join(', ')}`)
      .join('\n');

    const text = 
`📦 *মাল্টিপল টপ-আপ অর্ডার তালিকা (Parallel Orders)*

আমরা আপনার মেসেজে একাধিক Player UID পেয়েছি:
${subList}

💳 অনুগ্রহ করে সবগুলোর মোট মূল্য আমাদের বিকাশ/রকেট (\`01872239597\`) বা নগদ (\`01330719250\`) নাম্বারে পাঠিয়ে **TrxID** দিন।
TrxID পাওয়ার পর সবগুলো অর্ডার একসাথে প্রসেস করা হবে! ⚡`;

    return {
      finalResponseText: text,
      buttons: [
        { id: 'btn_catalog', title: '💎 UC প্রাইস লিস্ট' },
        { id: 'btn_website', title: '🌐 ওয়েবসাইট ২% ছাড়' }
      ]
    };
  }

  // Execute Parallel Atomic Orders via Promise.allSettled
  console.log(`[LangGraph Parallel Execution] Dispatching ${parallelDrafts.length} parallel orders for ${phone}...`);
  const executionPromises = parallelDrafts.map((draft, idx) =>
    createOrderTool.invoke({
      customerPhone: draft.customerPhone || phone,
      customerName: `PUBG Player #${idx + 1}`,
      playerUid: draft.playerUid,
      trxId: draft.trxId,
      paymentMethod: draft.paymentMethod || 'bKash/Nagad/Rocket',
      items: draft.items,
      customerNotes: `Parallel Order #${idx + 1} of ${parallelDrafts.length}`,
      conversationId: `${conversationId}_sub_${idx}`
    })
  );

  const results = await Promise.allSettled(executionPromises);
  const createdOrders: any[] = [];
  const failedOrders: any[] = [];

  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    if (res.status === 'fulfilled') {
      try {
        const parsed = JSON.parse(res.value);
        if (parsed.success) {
          createdOrders.push(parsed);
        } else {
          failedOrders.push({ draft: parallelDrafts[i], error: parsed.error });
        }
      } catch (err) {
        failedOrders.push({ draft: parallelDrafts[i], error: String(err) });
      }
    } else {
      failedOrders.push({ draft: parallelDrafts[i], error: res.reason });
    }
  }

  // Clear parallel drafts from session state after successful execution
  db.setSessionState(conversationId, {
    step: 'ORDER_PLACED',
    parallelDrafts: undefined,
    lastCreatedOrders: createdOrders.map(o => o.order_id)
  });

  const successList = createdOrders
    .map(o => `✅ <b>Order ID:</b> <code>${o.order_id}</code> | 🎮 <b>UID:</b> <code>${o.player_uid}</code> (৳${o.total_amount})`)
    .join('\n');

  const totalCombined = createdOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

  const text = 
`🎉 *${createdOrders.length}টি টপ-আপ অর্ডার সফলভাবে প্লেস করা হয়েছে!*

${successList}

💰 *সর্বমোট মূল্য:* ৳${totalCombined}
⚡ *ডেলিভারি সময়:* ৫–১৫ মিনিট (প্রত্যেকটি অ্যাকাউন্টে সমান্তরালে টপ-আপ সম্পন্ন হবে)

টপ-আপ টিম খুব দ্রুত সবগুলো অ্যাকাউন্টে ইউসি পাঠিয়ে দেবে! 🚀`;

  return {
    finalResponseText: text,
    createdOrders,
    buttons: [
      { id: `track:${createdOrders[0]?.order_id || 'recent'}`, title: '📦 অর্ডার ট্র্যাক' },
      { id: 'btn_catalog', title: '💎 UC প্রাইস লিস্ট' },
      { id: 'btn_website', title: '🌐 ওয়েবসাইট ২% ছাড়' }
    ]
  };
}

// ==========================================
// 6. ORDER TRACKING NODE
// ==========================================
async function handleTrackingNode(state: OrderGraphState): Promise<Partial<OrderGraphState>> {
  const { phone, messageText } = state;
  const orderMatch = messageText.match(/WAP-\d+-\d+/i);
  const targetCode = orderMatch ? orderMatch[0].toUpperCase() : undefined;

  let trackText = '';
  if (targetCode) {
    const raw = await trackOrderTool.invoke({ orderId: targetCode });
    const res = JSON.parse(raw);
    if (res.found) {
      const o = res.order;
      trackText = 
`📦 *অর্ডার স্ট্যাটাস (Order Status):*

• **Order ID:** \`${o.order_id}\`
• **Player UID:** \`${o.player_uid || 'N/A'}\`
• **স্ট্যাটাস:** *${o.status}*
• **মোট মূল্য:** ৳${o.total_amount}
• **ডেলিভারি সময়:** ৫–১৫ মিনিট`;
    } else {
      trackText = `⚠️ অর্ডার \`${targetCode}\` খুঁজে পাওয়া যায়নি। অনুগ্রহ করে সঠিক Order ID দিন।`;
    }
  } else {
    const raw = await getCustomerOrdersTool.invoke({ customerPhone: phone });
    const res = JSON.parse(raw);
    if (res.orders && res.orders.length > 0) {
      const list = res.orders.slice(0, 3).map((o: any) => `• \`${o.order_id}\` - ${o.status} (৳${o.total_amount})`).join('\n');
      trackText = `📦 *আপনার সাম্প্রতিক অর্ডারসমূহ:*\n\n${list}`;
    } else {
      trackText = `📦 আপনার এই ফোন নাম্বার দিয়ে কোনো সাম্প্রতিক অর্ডার পাওয়া যায়নি।`;
    }
  }

  return {
    finalResponseText: trackText,
    buttons: [
      { id: 'btn_catalog', title: '💎 UC প্রাইস লিস্ট' },
      { id: 'btn_website', title: '🌐 ওয়েবসাইট ২% ছাড়' }
    ]
  };
}

// ==========================================
// 7. GENERAL GUIDANCE / FALLBACK NODE
// ==========================================
async function handleGeneralGuideNode(state: OrderGraphState): Promise<Partial<OrderGraphState>> {
  const text = 
`🎮 **DS Dukan PUBG Top-Up Center** ⚡

ইউসি কিনতে আপনার কাঙ্ক্ষিত প্যাকেজ (যেমন: 60 UC, 385 UC) এবং Player UID লিখে জানান।
পেমেন্ট করুন আমাদের বিকাশ/রকেট (01872239597) অথবা নগদ (01330719250) নাম্বারে এবং TrxID দিন।

ডেলিভারি সময়: ৫–১৫ মিনিট। কোনো পাসওয়ার্ড বা লগইন আইডি প্রয়োজন নেই! ❤️`;

  return {
    finalResponseText: text,
    buttons: [
      { id: 'btn_catalog', title: '💎 UC প্রাইস লিস্ট' },
      { id: 'btn_website', title: '🌐 ওয়েবসাইট ২% ছাড়' }
    ]
  };
}

// ==========================================
// 8. CONDITIONAL ROUTER LOGIC
// ==========================================
function routeByIntent(state: OrderGraphState): string {
  switch (state.intent) {
    case 'GREETING':
    case 'CATALOG':
    case 'FAQ':
      return 'catalogFaq';
    case 'PARALLEL_ORDER':
      return 'parallelOrder';
    case 'SINGLE_ORDER':
      return 'singleOrder';
    case 'TRACK_ORDER':
      return 'trackOrder';
    default:
      return 'generalGuide';
  }
}

// ==========================================
// 9. BUILD & COMPILE LANGGRAPH STATE MACHINE
// ==========================================
export function createOrderStateGraph() {
  const workflow = new StateGraph(OrderGraphAnnotation)
    .addNode('extractSlots', extractAndSyncSlotsNode)
    .addNode('classifyIntent', classifyIntentNode)
    .addNode('catalogFaq', handleCatalogAndFaqNode)
    .addNode('singleOrder', handleSingleOrderNode)
    .addNode('parallelOrder', handleParallelOrderNode)
    .addNode('trackOrder', handleTrackingNode)
    .addNode('generalGuide', handleGeneralGuideNode)

    .addEdge(START, 'extractSlots')
    .addEdge('extractSlots', 'classifyIntent')
    .addConditionalEdges('classifyIntent', routeByIntent, {
      catalogFaq: 'catalogFaq',
      singleOrder: 'singleOrder',
      parallelOrder: 'parallelOrder',
      trackOrder: 'trackOrder',
      generalGuide: 'generalGuide'
    })
    .addEdge('catalogFaq', END)
    .addEdge('singleOrder', END)
    .addEdge('parallelOrder', END)
    .addEdge('trackOrder', END)
    .addEdge('generalGuide', END);

  return workflow.compile();
}

export const orderStateGraph = createOrderStateGraph();
