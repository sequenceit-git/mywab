import { ChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { db } from '@/lib/db';
import { telegramBot } from '@/lib/telegram/bot';
import { whatsappService, WhatsAppButton } from '@/lib/whatsapp/service';
import { env } from '@/lib/config/env';
import { ConversationSessionState } from '@/types';

export interface StructuredAgentResponse {
  text: string;
  buttons?: WhatsAppButton[];
  createdOrder?: any;
}

// 1. LangChain Tools Definition

export const searchCatalogTool = tool(
  async ({ query }: { query: string }) => {
    const products = await db.getProducts();
    const cleanQuery = query.toLowerCase().trim();

    const matched = products.filter(
      p =>
        p.name_en.toLowerCase().includes(cleanQuery) ||
        p.name_bn.includes(cleanQuery) ||
        p.category.toLowerCase().includes(cleanQuery) ||
        p.sku.toLowerCase().includes(cleanQuery)
    );

    const results = (matched.length > 0 ? matched : products);

    return JSON.stringify({
      count: results.length,
      products: results.map(p => ({
        id: p.id,
        sku: p.sku,
        name_en: p.name_en,
        name_bn: p.name_bn,
        price: `৳${p.price}`,
        category: p.category,
        description_bn: p.description_bn,
        description_en: p.description_en
      }))
    });
  },
  {
    name: 'search_catalog',
    description: 'Search for PUBG UC packages, Growth Packs, and Prime subscriptions in the DS Dukan catalog.',
    schema: z.object({
      query: z.string().describe('Package name, UC amount, or keyword (e.g. "60 UC", "385 UC", "growth pack", "prime", "uc rate")')
    })
  }
);

export const getFaqTool = tool(
  async ({ topic }: { topic: string }) => {
    const faqs = await db.getFAQs();
    const cleanTopic = topic.toLowerCase();

    const matched = faqs.filter(
      f =>
        f.question_en.toLowerCase().includes(cleanTopic) ||
        f.question_bn.includes(cleanTopic) ||
        f.category.toLowerCase().includes(cleanTopic)
    );

    return JSON.stringify({
      results: (matched.length > 0 ? matched : faqs).map(f => ({
        category: f.category,
        question_bn: f.question_bn,
        answer_bn: f.answer_bn,
        question_en: f.question_en,
        answer_en: f.answer_en
      }))
    });
  },
  {
    name: 'get_faq',
    description: 'Look up answered Q&As: greetings ("bhai acen", "hlw"), pricing queries, delivery times (5-15 mins for website/chat orders), ordering instructions ("uc nibo vaiya"), login UC safety policy, payment accounts, and website discounts.',
    schema: z.object({
      topic: z.string().describe('Topic keyword or user query (e.g. "bhai acen", "delivery time", "login uc", "uc nibo", "payment", "discount")')
    })
  }
);

export const updateDraftOrderTool = tool(
  async (params: {
    conversationId?: string;
    customerPhone?: string;
    customerName?: string;
    playerUid?: string;
    paymentMethod?: string;
    trxId?: string;
    items?: Array<{ skuOrName: string; quantity: number }>;
    customerNotes?: string;
  }) => {
    const convId = params.conversationId || 'default';
    const currentState = db.getSessionState(convId);

    const mergedItems = params.items && params.items.length > 0
      ? params.items
      : currentState.draftOrder.items;

    const mergedName = params.customerName || currentState.draftOrder.customerName;
    const mergedUid = params.playerUid || currentState.draftOrder.playerUid;
    const mergedPaymentMethod = params.paymentMethod || currentState.draftOrder.paymentMethod;
    const mergedTrxId = params.trxId || currentState.draftOrder.trxId;
    const mergedPhone = params.customerPhone || currentState.draftOrder.customerPhone;
    const mergedNotes = params.customerNotes || currentState.draftOrder.customerNotes;

    const hasItems = mergedItems && mergedItems.length > 0;
    const hasUid = Boolean(mergedUid && mergedUid.trim());
    const hasPayment = Boolean(mergedTrxId && mergedTrxId.trim());

    let determinedStep: 'IDLE' | 'COLLECTING_DETAILS' | 'AWAITING_PAYMENT' | 'AWAITING_CONFIRMATION' = 'COLLECTING_DETAILS';
    if (hasItems && hasUid && hasPayment) {
      determinedStep = 'AWAITING_CONFIRMATION';
    } else if (hasItems && hasUid && !hasPayment) {
      determinedStep = 'AWAITING_PAYMENT';
    } else if (!hasItems && !hasUid) {
      determinedStep = 'IDLE';
    }

    const updatedState = db.setSessionState(convId, {
      step: determinedStep,
      draftOrder: {
        items: mergedItems,
        customerName: mergedName,
        playerUid: mergedUid,
        deliveryAddress: mergedUid ? `Player UID: ${mergedUid}` : undefined,
        paymentMethod: mergedPaymentMethod,
        trxId: mergedTrxId,
        customerPhone: mergedPhone,
        customerNotes: mergedNotes
      }
    });

    return JSON.stringify({
      success: true,
      step: updatedState.step,
      draftOrder: updatedState.draftOrder,
      allDetailsReady: determinedStep === 'AWAITING_CONFIRMATION',
      message: determinedStep === 'AWAITING_CONFIRMATION'
        ? 'All order details and payment TrxID received! Ready to confirm and place top-up.'
        : determinedStep === 'AWAITING_PAYMENT'
        ? 'Player UID received. Send payment instructions (bKash/Nagad/Rocket) and request TrxID / last 4 digits.'
        : 'Draft details updated in session memory.'
    });
  },
  {
    name: 'update_draft_order',
    description: 'Save or update digital order details (PUBG package, Player UID, payment method, TrxID / last 4 digits) to session memory.',
    schema: z.object({
      conversationId: z.string().nullable().optional().describe('The current conversation ID'),
      customerPhone: z.string().nullable().optional().describe('Customer contact phone number'),
      customerName: z.string().nullable().optional().describe('Customer name or in-game name'),
      playerUid: z.string().nullable().optional().describe('PUBG Mobile Player UID (e.g. 5123456789)'),
      paymentMethod: z.string().nullable().optional().describe('Payment method used (bKash, Nagad, Rocket)'),
      trxId: z.string().nullable().optional().describe('Transaction ID (TrxID) or last 4 digits of sender number'),
      items: z.array(
        z.object({
          skuOrName: z.string().describe('Product SKU or name (e.g. "60 UC", "385 UC", "Growth Pack 1")'),
          quantity: z.number().describe('Quantity of items')
        })
      ).nullable().optional().describe('List of ordered packages'),
      customerNotes: z.string().nullable().optional().describe('Customer notes')
    })
  }
);

export const createOrderTool = tool(
  async (params: {
    customerPhone: string;
    customerName: string;
    playerUid?: string;
    trxId?: string;
    paymentMethod?: string;
    items: Array<{ skuOrName: string; quantity: number }>;
    customerNotes?: string;
    conversationId?: string;
  }) => {
    try {
      // 0. ANTI-DUPLICATE GUARD: Check if an order was placed by this customer in the last 5 minutes
      const existingRecentOrders = await db.getOrdersByPhone(params.customerPhone);
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const recentOrder = existingRecentOrders.find(o => new Date(o.created_at).getTime() > fiveMinutesAgo);

      if (recentOrder) {
        console.log(`[Anti-Duplicate Guard] Blocked duplicate order creation for ${params.customerPhone}. Existing order: ${recentOrder.order_id}`);
        if (params.conversationId) {
          db.clearSessionDraft(params.conversationId, recentOrder.order_id);
        }
        return JSON.stringify({
          success: true,
          already_created: true,
          order_id: recentOrder.order_id,
          total_amount: recentOrder.total_amount,
          player_uid: recentOrder.player_uid,
          trx_id: recentOrder.trx_id,
          status: recentOrder.status,
          message: `Top-Up Order #${recentOrder.order_id} has ALREADY been placed and is being processed (Delivery Time: 5-15 mins). DO NOT CREATE ANOTHER ORDER.`
        });
      }

      // 1. Resolve customer
      const user = await db.getOrCreateUser(params.customerPhone, params.customerName);

      // 2. Resolve items with pricing from catalog
      const allProducts = await db.getProducts();
      const resolvedItems: Array<{ product_id?: string; product_name: string; unit_price: number; quantity: number }> = [];

      const rateMap: Record<string, number> = {
        '60': 115,
        '120': 230,
        '180': 340,
        '325': 600,
        '385': 710,
        '660': 1150,
        '720': 1250,
        '1045': 1850,
        '1800': 3150,
        '3850': 6500,
        '8100': 13500,
        'growth pack 1': 150,
        'gp 1': 150,
        'growth pack 2': 390,
        'gp 2': 390,
        'growth pack 3': 590,
        'gp 3': 590,
        'prime plus': 1150,
        'prime 1 month': 150,
        'prime': 150
      };

      for (const item of params.items) {
        const itemLower = item.skuOrName.toLowerCase();
        const found = allProducts.find(
          p =>
            p.sku.toLowerCase() === itemLower ||
            p.name_en.toLowerCase().includes(itemLower) ||
            itemLower.includes(p.name_en.toLowerCase()) ||
            p.name_bn.includes(item.skuOrName)
        );

        if (found) {
          resolvedItems.push({
            product_id: found.id,
            product_name: found.name_bn || found.name_en,
            unit_price: Number(found.price),
            quantity: item.quantity || 1
          });
        } else {
          let resolvedPrice = 115;
          const sortedEntries = Object.entries(rateMap).sort((a, b) => b[0].length - a[0].length);
          for (const [key, price] of sortedEntries) {
            if (itemLower.includes(key)) {
              resolvedPrice = price;
              break;
            }
          }
          resolvedItems.push({
            product_name: item.skuOrName,
            unit_price: resolvedPrice,
            quantity: item.quantity || 1
          });
        }
      }

      if (resolvedItems.length === 0) {
        return JSON.stringify({ success: false, error: 'No valid products could be resolved.' });
      }

      // 3. Create the Order in Central Database
      const order = await db.createOrder({
        userId: user.id,
        items: resolvedItems,
        deliveryPhone: params.customerPhone,
        playerUid: params.playerUid,
        trxId: params.trxId,
        paymentMethod: params.paymentMethod,
        customerNotes: params.customerNotes
      });

      // 4. Automatically Forward to Telegram Worker Group
      await telegramBot.dispatchNewOrder(order);

      // 5. Clear the active draft session state
      if (params.conversationId) {
        db.clearSessionDraft(params.conversationId, order.order_id);
      }

      return JSON.stringify({
        success: true,
        order_id: order.order_id,
        total_amount: order.total_amount,
        player_uid: order.player_uid,
        trx_id: order.trx_id,
        payment_method: order.payment_method,
        delivery_phone: order.delivery_phone,
        message: 'Top-up order created successfully and forwarded to Telegram worker dispatch team (Delivery: 5-15 mins).'
      });
    } catch (err) {
      return JSON.stringify({ success: false, error: String(err) });
    }
  },
  {
    name: 'create_order',
    description: 'Create a NEW confirmed top-up order for the customer. ONLY invoke this when placing a brand new top-up order with Player UID.',
    schema: z.object({
      customerPhone: z.string().describe('Customer phone number (e.g. +88017XXXXXXXX)'),
      customerName: z.string().describe('Full name or in-game name of the customer'),
      playerUid: z.string().nullable().optional().describe('PUBG Player UID (e.g. 5123456789)'),
      trxId: z.string().nullable().optional().describe('Payment TrxID or sender last 4 digits'),
      paymentMethod: z.string().nullable().optional().describe('Payment method (BKASH, NAGAD, ROCKET)'),
      items: z.array(
        z.object({
          skuOrName: z.string().describe('Product SKU or name (e.g. "60 UC", "385 UC", "Growth Pack 1")'),
          quantity: z.number().describe('Quantity of items')
        })
      ).describe('List of ordered items'),
      customerNotes: z.string().nullable().optional().describe('Any special customer notes'),
      conversationId: z.string().nullable().optional().describe('Current conversation ID')
    })
  }
);

export const trackOrderTool = tool(
  async ({ orderId }: { orderId: string }) => {
    const order = await db.getOrderByCode(orderId.trim().toUpperCase());
    if (!order) {
      return JSON.stringify({ found: false, message: `No order found with ID ${orderId}` });
    }

    const statusTranslations: Record<string, string> = {
      PENDING_PAYMENT: 'পেমেন্ট প্রক্রিয়াধীন (Pending Payment)',
      PENDING_CLAIM: 'কর্মী গ্রহণের অপেক্ষায় (Waiting for Worker Assignment)',
      CLAIMED: 'কর্মী অর্ডার গ্রহণ করেছেন এবং প্রসেস করছেন (Claimed & Processing)',
      PROCESSING: 'অর্ডার প্যাকেজিং ও প্রসেসিং চলছে (Packaging)',
      OUT_FOR_DELIVERY: 'ডেলিভারির জন্য বের হয়েছে (Out for Delivery)',
      DELIVERED: 'ডেলিভারি সম্পন্ন (Successfully Delivered)',
      CANCELLED: 'বাতিল করা হয়েছে (Cancelled)'
    };

    return JSON.stringify({
      found: true,
      order_id: order.order_id,
      status: order.status,
      status_bn: statusTranslations[order.status] || order.status,
      total_amount: `৳${order.total_amount}`,
      created_at: order.created_at,
      delivery_address: order.delivery_address?.address,
      worker: order.current_worker ? order.current_worker.full_name : 'Not yet assigned'
    });
  },
  {
    name: 'track_order',
    description: 'Track the live status of an order using its order ID code (e.g. WAP-20260914-1234).',
    schema: z.object({
      orderId: z.string().describe('The order ID (e.g. WAP-20260914-1234)')
    })
  }
);

export const getCustomerOrdersTool = tool(
  async ({ customerPhone }: { customerPhone: string }) => {
    const orders = await db.getOrdersByPhone(customerPhone);
    if (orders.length === 0) {
      return JSON.stringify({ count: 0, message: 'No orders found for this phone number.' });
    }

    return JSON.stringify({
      count: orders.length,
      orders: orders.slice(0, 3).map(o => ({
        order_id: o.order_id,
        status: o.status,
        total: o.total_amount,
        items: (o.items || []).map(i => `${i.product_name} x${i.quantity}`).join(', '),
        date: new Date(o.created_at).toLocaleDateString()
      }))
    });
  },
  {
    name: 'get_customer_orders',
    description: 'Look up past and recent orders placed by this customer phone number.',
    schema: z.object({
      customerPhone: z.string().describe('Customer phone number')
    })
  }
);

// 2. LangChain + OpenAI Conversational AI Agent Core

export class LangChainAgentService {
  private tools = [
    searchCatalogTool,
    getFaqTool,
    updateDraftOrderTool,
    createOrderTool,
    trackOrderTool,
    getCustomerOrdersTool
  ];

  private getLLM() {
    if (!env.openai.apiKey) {
      return null;
    }
    return new ChatOpenAI({
      openAIApiKey: env.openai.apiKey,
      modelName: env.openai.model || 'gpt-4o-mini',
      temperature: 0.3
    });
  }

  getSystemPrompt(params: { customerPhone: string; sessionState: ConversationSessionState }): string {
    const { customerPhone, sessionState } = params;
    const draft = sessionState.draftOrder;

    const draftInfo = `
ACTIVE SESSION STATE & CART MEMORY:
- Step: ${sessionState.step}
- Draft Package(s): ${draft.items && draft.items.length > 0 ? draft.items.map(i => `${i.skuOrName} (Qty: ${i.quantity})`).join(', ') : 'None currently in draft'}
- Customer Name / In-Game Name: ${draft.customerName || 'Not yet provided'}
- PUBG Player UID: ${draft.playerUid || 'Not yet provided'}
- Payment Method: ${draft.paymentMethod || 'Not yet provided'}
- TrxID / Last 4 Digits: ${draft.trxId || 'Not yet provided'}
- Contact Phone: ${draft.customerPhone || customerPhone || 'Not yet provided'}
- Last Placed Order ID: ${sessionState.lastOrderId || 'None'}
`;

    const placedNotice = sessionState.lastOrderId
      ? `\nIMPORTANT NOTICE ON RECENT TOP-UP ORDER:\nTop-Up Order #${sessionState.lastOrderId} was ALREADY PLACED AND SENT TO DISPATCH. If customer asks "Confirm hoyese?", "Is it confirmed?", "Koto time lagbe?", confirm that Order #${sessionState.lastOrderId} is confirmed and being processed (Delivery: 5-15 mins). DO NOT re-ask for details and DO NOT say it is not confirmed.\n`
      : '';

    return `You are "DS Dukan Assistant", the fast, friendly, and expert WhatsApp AI assistant for **DS Dukan** (https://www.dsdukan.com/#) - the leading digital top-up shop for PUBG Mobile UC, Growth Packs, and Prime Subscriptions in Bangladesh.
Current Customer Phone: ${customerPhone}

${draftInfo}${placedNotice}

ABOUT DS DUKAN:
- Shop Name: DS Dukan
- Website: https://www.dsdukan.com/#
- Website Discount: Website purchase gets an automatic 2% discount (no coupon needed, price is already discounted), plus an extra 2% discount with a collected coupon!
- Delivery Speed: Super fast delivery within 5 to 15 Minutes!
- Account Safety: Only PUBG Player UID is needed. No account password, login, or access is EVER required.

CURRENT PRICE LIST (REGULAR UC):
- 60 UC : 115 Tk BDT
- 120 UC : 230 Tk BDT
- 180 UC : 340 Tk BDT
- 325 UC : 600 Tk BDT
- 385 UC [50 RP] : 710 Tk BDT
- 660 UC : 1150 Tk BDT
- 720 UC [100 RP] : 1250 Tk BDT
- 1045 UC : 1850 Tk BDT
- 1800 UC : [ASK FOR LIVE RATE]
- 3850 UC : [ASK FOR LIVE RATE]
- 8100 UC : [ASK FOR LIVE RATE]

PUBG MOBILE GROWTH PACKS:
- Growth Pack 1 : 150 Tk
- Growth Pack 2 : 390 Tk
- Growth Pack 3 : 590 Tk

PUBG MOBILE PRIME SUBSCRIPTION:
- Prime 1 Month : 150 Tk
- Prime Plus 1 Month : 1150 Tk

PAYMENT METHODS & NUMBERS (Personal / Send Money / Cash In):
- bKash : 01872239597 (Personal)
- Rocket : 01872239597 (Personal)
- Nagad : 01330719250 (Personal)

ORDERING LIFECYCLE & STATE RULES:
1. When customer inquires about packages or rates:
   - Provide the requested UC/Growth Pack price clearly in Bengali.
   - Mention that only their Player UID is needed (no password).
   - Inform them about the 2% discount on the website (https://www.dsdukan.com/#).
2. When customer selects package or provides Player UID:
   - Call \`update_draft_order\` to save these details into active session state.
   - If Player UID is provided, give the payment numbers (bKash/Rocket 01872239597, Nagad 01330719250) and ask them to send money and reply with the TrxID or sender number last 4 digits.
3. When TrxID or last 4 digits are received:
   - Call \`update_draft_order\` with the trxId and paymentMethod.
   - When package, Player UID, and TrxID are all present, present a brief Top-Up Summary and confirm.
4. CRITICAL MULTI-TURN CONFIRMATION (EXTREMELY IMPORTANT):
   - When Player UID and TrxID are received or customer confirms (e.g. "Yes", "Confirm", "Paid", "Done", "হ্যাঁ", "কনফার্ম করুন", "টাকা পাঠিয়েছি"):
     -> IMMEDIATELY invoke \`create_order\` using the details from Active Session State!
     -> NEVER ask customer to re-enter UID or TrxID if already in session state!
5. ANTI-DUPLICATE RULES:
   - If an order was already placed (Last Placed Order ID is present) and customer asks about status, reassure them using their Order ID. DO NOT call \`create_order\` again!

CONVERSATIONAL RULES:
- Be polite, fast, and helpful in fluent Bengali (বাংলা) or Banglish/English if preferred.
- Use gaming/top-up emojis (🎮, 💎, ⚡, 👑, ✅).
- Always format prices with Tk / ৳ (e.g. ৳115 / 115 Tk).`;
  }

  /**
   * Process customer message returning structured text and interactive button options
   */
  async processStructuredMessage(params: {
    phone: string;
    messageText: string;
    conversationId: string;
  }): Promise<StructuredAgentResponse> {
    const { phone, messageText, conversationId } = params;
    const lowerMessage = messageText.toLowerCase().trim();

    // 1. Fetch current session state & conversation history
    const sessionState = db.getSessionState(conversationId);
    const draft = sessionState.draftOrder;

    // 2. Check Affirmation Fast-Path
    // If we have package + UID + TrxID (or customer confirms)
    const isAffirmative = [
      'yes', 'yes all okey', 'yes all ok', 'all okey', 'all ok', 'okey', 'ok', 'okay',
      'confirm', 'confirmed', 'plz confirm', 'please confirm', 'proceed', 'done', 'paid',
      'thik ase', 'thik ache', 'thik', 'yes please', 'yes go ahead',
      'হ্যাঁ', 'হ্যা', 'ঠিক আছে', 'কনফার্ম', 'কনফার্ম করুন', 'টাকা পাঠিয়েছি', 'টাকা দিছি', 'অর্ডার করুন', 'অর্ডার দিন', 'এগিয়ে যান', 'অর্ডার কনফার্ম'
    ].some(phrase => lowerMessage === phrase || lowerMessage.startsWith(phrase));

    const hasTopUpSlots = Boolean(
      draft.items && draft.items.length > 0 &&
      draft.playerUid
    );

    if ((sessionState.step === 'AWAITING_CONFIRMATION' || (hasTopUpSlots && draft.trxId)) && isAffirmative) {
      console.log(`[AI Fast-Path] Affirmative top-up response received in state ${sessionState.step}. Placing top-up order directly...`);
      const targetPhone = draft.customerPhone || phone;
      const targetName = draft.customerName || 'PUBG Player';
      const targetUid = draft.playerUid || 'N/A';
      const targetTrx = draft.trxId || 'N/A';
      const targetPayment = draft.paymentMethod || 'bKash/Nagad/Rocket';
      const targetItems = draft.items && draft.items.length > 0 ? draft.items : [{ skuOrName: '60 UC', quantity: 1 }];

      const toolResultRaw = await createOrderTool.invoke({
        customerPhone: targetPhone,
        customerName: targetName,
        playerUid: targetUid,
        trxId: targetTrx,
        paymentMethod: targetPayment,
        items: targetItems,
        customerNotes: draft.customerNotes,
        conversationId
      });

      const toolResult = JSON.parse(toolResultRaw);
      if (toolResult.success) {
        const text = 
`🎉 *টপ-আপ অর্ডার সফলভাবে গ্রহণ করা হয়েছে!*

📦 *Order ID:* \`${toolResult.order_id}\`
🎮 *Player UID:* \`${toolResult.player_uid || targetUid}\`
💎 *প্যাকেজ:* ${targetItems.map(i => `${i.skuOrName} x${i.quantity}`).join(', ')}
💰 *মোট মূল্য:* ৳${toolResult.total_amount}
💳 *পেমেন্ট:* ${toolResult.payment_method || targetPayment} (TrxID: \`${toolResult.trx_id || targetTrx}\`)
⚡ *ডেলিভারি সময়:* ৫–১৫ মিনিট (5-15 Minutes)

আপনার টপ-আপ প্রসেসিং শুরু হয়েছে। খুব শীঘ্রই ইউসি আপনার আইডিতে যুক্ত হয়ে যাবে! 🚀✨`;

        const buttons: WhatsAppButton[] = [
          { id: `track:${toolResult.order_id}`, title: '📦 অর্ডার ট্র্যাক' },
          { id: 'btn_catalog', title: '💎 UC প্রাইস লিস্ট' },
          { id: 'btn_support', title: '👤 কাস্টমার কেয়ার' }
        ];

        return { text, buttons };
      }
    }

    const llm = this.getLLM();

    // 3. If OpenAI API Key is configured, use LangChain Agent
    if (llm && env.openai.apiKey) {
      try {
        console.log(`[AI Agent] Processing message from ${phone}: "${messageText}" using model ${env.openai.model} (Step: ${sessionState.step})`);
        const modelWithTools = llm.bindTools(this.tools);

        const conversations = await db.getConversations();
        const conv = conversations.find(c => c.id === conversationId);
        const historyMessages = conv?.messages || [];

        // Exclude the very last message if it matches messageText to avoid duplication
        const pastMessages = (historyMessages.length > 0 && historyMessages[historyMessages.length - 1].content === messageText)
          ? historyMessages.slice(0, -1)
          : historyMessages;

        const formattedHistory: Array<['system' | 'human' | 'ai', string]> = [
          ['system', this.getSystemPrompt({ customerPhone: phone, sessionState })]
        ];

        pastMessages.slice(-8).forEach(m => {
          formattedHistory.push([m.sender === 'CUSTOMER' ? 'human' : 'ai', m.content]);
        });

        formattedHistory.push(['human', messageText]);

        const response = await modelWithTools.invoke(formattedHistory);

        // Handle tool calls
        if (response.tool_calls && response.tool_calls.length > 0) {
          for (const call of response.tool_calls) {
            const toolMap: Record<string, any> = {
              search_catalog: searchCatalogTool,
              get_faq: getFaqTool,
              update_draft_order: updateDraftOrderTool,
              create_order: createOrderTool,
              track_order: trackOrderTool,
              get_customer_orders: getCustomerOrdersTool
            };

            const matchedTool = toolMap[call.name];
            if (matchedTool) {
              const toolArgs = {
                ...call.args,
                conversationId
              };
              const toolResult = await matchedTool.invoke(toolArgs);
              
              const followUp = await llm.invoke([
                ...formattedHistory,
                ['ai', JSON.stringify(response.tool_calls)],
                ['human', `Tool ${call.name} returned: ${toolResult}. Please give a friendly WhatsApp response to the customer in Bengali/English.`]
              ]);

              const text = String(followUp.content);
              const buttons = this.deriveContextualButtons(messageText, text, sessionState);
              return { text, buttons };
            }
          }
        }

        if (response.content) {
          const text = String(response.content);
          const buttons = this.deriveContextualButtons(messageText, text, sessionState);
          return { text, buttons };
        }
      } catch (err) {
        console.error('LangChain OpenAI Agent Error:', err);
      }
    }

    // 4. High-quality rule-based heuristic fallback engine with rich interactive buttons
    return this.fallbackEngineStructured(phone, messageText, conversationId);
  }

  /**
   * Legacy string processor
   */
  async processMessage(params: {
    phone: string;
    messageText: string;
    conversationId: string;
  }): Promise<string> {
    const res = await this.processStructuredMessage(params);
    return res.text;
  }

  /**
   * Derive smart WhatsApp interactive buttons based on context & active step
   */
  private deriveContextualButtons(
    userText: string,
    aiReply: string,
    sessionState?: ConversationSessionState
  ): WhatsAppButton[] {
    const lowerUser = userText.toLowerCase();
    const lowerReply = aiReply.toLowerCase();

    // If order was created or confirmed
    if (lowerReply.includes('order id') || lowerReply.includes('সফলভাবে') || lowerReply.includes('ds-')) {
      return [
        { id: 'btn_track', title: '📦 অর্ডার ট্র্যাক' },
        { id: 'btn_catalog', title: '💎 UC প্রাইস লিস্ট' },
        { id: 'btn_website', title: '🌐 ওয়েবসাইট ২% ছাড়' }
      ];
    }

    // If verification summary card is presented (Awaiting confirmation or payment)
    if (
      lowerReply.includes('যাচাই করুন') ||
      lowerReply.includes('নিশ্চিত করার জন্য') ||
      lowerReply.includes('টপ-আপ') ||
      lowerReply.includes('trxid') ||
      sessionState?.step === 'AWAITING_CONFIRMATION'
    ) {
      return [
        { id: 'btn_confirm_order', title: '✅ কনফার্ম করুন' },
        { id: 'btn_payment', title: '💳 পেমেন্ট নাম্বার' },
        { id: 'btn_catalog', title: '💎 UC প্রাইস' }
      ];
    }

    if (lowerUser.includes('payment') || lowerUser.includes('পেমেন্ট') || lowerUser.includes('বিকাশ') || lowerUser.includes('নগদ') || lowerUser.includes('রকেট')) {
      return [
        { id: 'btn_catalog', title: '💎 UC প্রাইস' },
        { id: 'btn_growth', title: '📦 Growth Pack' },
        { id: 'btn_website', title: '🌐 ওয়েবসাইট লিংক' }
      ];
    }

    return [
      { id: 'btn_catalog', title: '💎 UC প্রাইস লিস্ট' },
      { id: 'btn_growth', title: '📦 Growth Pack' },
      { id: 'btn_payment', title: '💳 পেমেন্ট নাম্বার' }
    ];
  }

  /**
   * Fast rule-based heuristic fallback engine with rich buttons for DS Dukan
   */
  private async fallbackEngineStructured(phone: string, text: string, conversationId: string): Promise<StructuredAgentResponse> {
    const lower = text.toLowerCase().trim();
    const sessionState = db.getSessionState(conversationId);

    // 1. Order Status / Confirmation Check
    if (
      lower.includes('confirm') ||
      lower.includes('কনফার্ম') ||
      lower.includes('নিশ্চিত') ||
      lower.includes('status') ||
      lower.includes('ট্র্যাক') ||
      lower.includes('track') ||
      lower.includes('ds-') ||
      lower.includes('koto time') ||
      lower.includes('হয়েছে')
    ) {
      const match = text.match(/DS-\d{8}-\d{4}/i);
      let order = null;
      if (match) {
        order = await db.getOrderByCode(match[0].toUpperCase());
      } else {
        const recentOrders = await db.getOrdersByPhone(phone);
        order = recentOrders[0] || null;
      }

      if (order) {
        return {
          text: `🎉 *টপ-আপ স্ট্যাটাস ও তথ্য*\n\nপ্রিয় গ্রাহক, আপনার টপ-আপ অর্ডারটি গ্রহণ করা হয়েছে।\n\n📦 *Order ID:* \`${order.order_id}\`\n🎮 *Player UID:* \`${order.player_uid || 'N/A'}\`\n📊 *বর্তমান স্ট্যাটাস:* *${order.status}*\n💰 *মোট মূল্য:* ৳${order.total_amount}\n⚡ *ডেলিভারি সময়:* ৫–১৫ মিনিট (5-15 Mins)\n\nআমাদের টিম খুব দ্রুত আপনার আইডিতে ইউসি পাঠিয়ে দেবে! 🚀`,
          buttons: [
            { id: `track:${order.order_id}`, title: '📦 অর্ডার ট্র্যাক' },
            { id: 'btn_catalog', title: '💎 UC প্রাইস লিস্ট' },
            { id: 'btn_support', title: '👤 কাস্টমার কেয়ার' }
          ]
        };
      }
    }

    // 2. Payment Number Inquiry
    if (
      lower.includes('payment') ||
      lower.includes('পেমেন্ট') ||
      lower.includes('bkash') ||
      lower.includes('বিকাশ') ||
      lower.includes('nagad') ||
      lower.includes('নগদ') ||
      lower.includes('rocket') ||
      lower.includes('রকেট') ||
      lower.includes('number') ||
      lower.includes('নাম্বার')
    ) {
      return {
        text: `💳 *DS Dukan পেমেন্ট নাম্বারসমূহ:*\n\n🔹 *BKASH (Personal):* \`01872239597\`\n🔹 *ROCKET (Personal):* \`01872239597\`\n🔹 *NAGAD (Personal):* \`01330719250\`\n\n*(Send Money অথবা Cash In করতে পারেন)*\n\nটাকা পাঠানোর পর আপনার **Player UID** এবং **TrxID / লাস্ট ৪ ডিজিট** মেসেজ দিন। টপ-আপ ৫-১৫ মিনিটে সম্পন্ন হবে! ⚡`,
        buttons: [
          { id: 'btn_catalog', title: '💎 UC প্রাইস লিস্ট' },
          { id: 'btn_growth', title: '📦 Growth Pack' },
          { id: 'btn_website', title: '🌐 ওয়েবসাইট ২% ছাড়' }
        ]
      };
    }

    // 3. Growth Pack Inquiry
    if (lower.includes('growth') || lower.includes('গ্রোথ') || lower.includes('pack')) {
      return {
        text: `📦 *AVAILABLE PUBG MOBILE GROWTH PACK* ✅\n\n▪️ Growth Pack 1 — *150 Tk*\n▪️ Growth Pack 2 — *390 Tk*\n▪️ Growth Pack 3 — *590 Tk*\n\n📌 *Only UID Need, no need any access!*\nডেলিভারি টাইম: ৫–১৫ মিনিট।\n\n🌐 ওয়েবসাইট থেকে কিনলে পাচ্ছেন ২% ডিসকাউন্ট: https://www.dsdukan.com/#`,
        buttons: [
          { id: 'btn_payment', title: '💳 পেমেন্ট নাম্বার' },
          { id: 'btn_catalog', title: '💎 UC প্রাইস লিস্ট' },
          { id: 'btn_website', title: '🌐 ওয়েবসাইট' }
        ]
      };
    }

    // 4. Prime / Prime Plus Inquiry
    if (lower.includes('prime') || lower.includes('প্রাইম')) {
      return {
        text: `👑 *PUBG MOBILE PRIME SUBSCRIPTION* ✅\n\n▪️ Prime (1 Month) — *150 Tk*\n▪️ Prime Plus (1 Month) — *1150 Tk*\n\n📌 *Only UID Need, no password required!*\nডেলিভারি টাইম: ৫–১৫ মিনিট।\n\n🌐 ওয়েবসাইট লিংক: https://www.dsdukan.com/#`,
        buttons: [
          { id: 'btn_payment', title: '💳 পেমেন্ট নাম্বার' },
          { id: 'btn_catalog', title: '💎 UC প্রাইস' },
          { id: 'btn_growth', title: '📦 Growth Pack' }
        ]
      };
    }

    // 5. Regular UC Price List / Catalog
    if (
      lower.includes('uc') ||
      lower.includes('ইউসি') ||
      lower.includes('price') ||
      lower.includes('দাম') ||
      lower.includes('list') ||
      lower.includes('তালিকা') ||
      lower.includes('catalog') ||
      lower.includes('rp')
    ) {
      return {
        text: `✅ *NEW UPDATED REGULAR UC LIST* ✅\n🔽🔽🔽\n〽️ 60 UC : *115 TK BDT*\n〽️ 120 UC : *230 TK BDT*\n〽️ 180 UC : *340 TK BDT*\n〽️ 325 UC : *600 TK BDT*\n〽️ 385 UC : *710 TK BDT* [ 50 RP ]\n〽️ 660 UC : *1150 TK BDT*\n〽️ 720 UC : *1250 TK BDT* [100 RP]\n〽️ 1045 UC : *1850 TK BDT*\n〽️ 1800 UC : [ ASK FOR LIVE RATE ]\n〽️ 3850 UC : [ ASK FOR LIVE RATE ]\n〽️ 8100 UC : [ ASK FOR LIVE RATE ]\n\n🎁 [ *NOTE:* ওয়েবসাইট থেকে ইউসি কিনলে পাচ্ছেন ২% ডিসকাউন্ট, কোন কুপন প্রয়োজন নাই অটোমেটিক দাম কমানো আছে, আর কুপন থাকলে আরো ২% ডিসকাউন্ট পাবেন!]\n🎉 BEST DISCOUNT FOR WEBSITE PURCHASE ❤️\n🌐 Website Link : https://www.dsdukan.com/#\n\n📌 *Only UID Need, no password or account access required!*\n⚡ ডেলিভারি টাইম: ৫–১৫ মিনিট।`,
        buttons: [
          { id: 'btn_growth', title: '📦 Growth Pack' },
          { id: 'btn_payment', title: '💳 পেমেন্ট নাম্বার' },
          { id: 'btn_website', title: '🌐 ওয়েবসাইট ২% ছাড়' }
        ]
      };
    }

    // 6. Player UID + TrxID Automated Fast Top-Up Placer
    const uidMatch = text.match(/(?:uid|id|আইডি)[:\s]+(\d{8,12})/i) || text.match(/\b(5\d{8,10})\b/);
    const trxMatch = text.match(/(?:trx|trxid|ট্রানজেকশন|লাস্ট)[:\s]+([a-zA-Z0-9]{4,12})/i) || text.match(/\b([A-Z0-9]{8,12})\b/i);

    if (uidMatch) {
      const extractedUid = uidMatch[1] || uidMatch[0];
      const extractedTrx = trxMatch ? (trxMatch[1] || trxMatch[0]) : undefined;

      // Extract package if mentioned
      let matchedPackage = '60 UC';
      let packagePrice = 115;
      if (lower.includes('385') || lower.includes('rp')) {
        matchedPackage = '385 UC [50 RP]';
        packagePrice = 710;
      } else if (lower.includes('660')) {
        matchedPackage = '660 UC';
        packagePrice = 1150;
      } else if (lower.includes('720')) {
        matchedPackage = '720 UC [100 RP]';
        packagePrice = 1250;
      } else if (lower.includes('325')) {
        matchedPackage = '325 UC';
        packagePrice = 600;
      } else if (lower.includes('120')) {
        matchedPackage = '120 UC';
        packagePrice = 230;
      } else if (lower.includes('180')) {
        matchedPackage = '180 UC';
        packagePrice = 340;
      } else if (lower.includes('1045')) {
        matchedPackage = '1045 UC';
        packagePrice = 1850;
      } else if (lower.includes('growth 1') || lower.includes('gp 1')) {
        matchedPackage = 'Growth Pack 1';
        packagePrice = 150;
      } else if (lower.includes('growth 2') || lower.includes('gp 2')) {
        matchedPackage = 'Growth Pack 2';
        packagePrice = 390;
      } else if (lower.includes('growth 3') || lower.includes('gp 3')) {
        matchedPackage = 'Growth Pack 3';
        packagePrice = 590;
      }

      // Update draft state
      db.setSessionState(conversationId, {
        step: extractedTrx ? 'AWAITING_CONFIRMATION' : 'AWAITING_PAYMENT',
        draftOrder: {
          items: [{ skuOrName: matchedPackage, quantity: 1 }],
          playerUid: extractedUid,
          trxId: extractedTrx,
          customerPhone: phone
        }
      });

      if (extractedTrx) {
        // Anti-duplicate check
        const recentOrders = await db.getOrdersByPhone(phone);
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        const recentOrder = recentOrders.find(o => new Date(o.created_at).getTime() > fiveMinutesAgo);

        if (recentOrder) {
          return {
            text: `🎉 প্রিয় গ্রাহক, আপনার টপ-আপ অর্ডারটি (\`${recentOrder.order_id}\`) ইতিমধ্যে গৃহীত হয়েছে।\n\n🎮 UID: \`${recentOrder.player_uid}\`\n💰 মূল্য: ৳${recentOrder.total_amount}\n⚡ ডেলিভারি সময়: ৫-১৫ মিনিট।`,
            buttons: [
              { id: `track:${recentOrder.order_id}`, title: '📦 অর্ডার ট্র্যাক' },
              { id: 'btn_catalog', title: '💎 UC প্রাইস' },
              { id: 'btn_support', title: '👤 সহায়তা' }
            ]
          };
        }

        const user = await db.getOrCreateUser(phone, `Player-${extractedUid}`);
        const order = await db.createOrder({
          userId: user.id,
          items: [{
            product_name: matchedPackage,
            unit_price: packagePrice,
            quantity: 1
          }],
          playerUid: extractedUid,
          trxId: extractedTrx,
          paymentMethod: 'bKash/Nagad/Rocket',
          deliveryPhone: phone,
          customerNotes: `PUBG Top-up for UID ${extractedUid}`
        });

        await telegramBot.dispatchNewOrder(order);
        db.clearSessionDraft(conversationId, order.order_id);

        return {
          text: `🎉 *টপ-আপ অর্ডার সফলভাবে নিশ্চিত করা হয়েছে!*

📦 *Order ID:* \`${order.order_id}\`
🎮 *Player UID:* \`${extractedUid}\`
💎 *প্যাকেজ:* ${matchedPackage}
💰 *মূল্য:* ৳${order.total_amount}
💳 *TrxID:* \`${extractedTrx}\`
⚡ *ডেলিভারি সময়:* ৫–১৫ মিনিট

আমাদের টিম আপনার আইডিতে ইউসি পাঠিয়ে দিচ্ছে! 🚀`,
          buttons: [
            { id: `track:${order.order_id}`, title: '📦 অর্ডার ট্র্যাক' },
            { id: 'btn_catalog', title: '💎 UC প্রাইস লিস্ট' },
            { id: 'btn_support', title: '👤 সহায়তা' }
          ],
          createdOrder: order
        };
      }

      // If UID received but TrxID is missing
      return {
        text: `🎮 *Player UID:* \`${extractedUid}\` ও প্যাকেজ: *${matchedPackage}* (${packagePrice} Tk) গৃহীত হয়েছে!

💳 অনুগ্রহ করে নিচের যেকোনো নাম্বারে *${packagePrice} টাকা* Send Money / Cash In করুন:
▪️ *BKASH (Personal):* \`01872239597\`
▪️ *ROCKET (Personal):* \`01872239597\`
▪️ *NAGAD (Personal):* \`01330719250\`

টাকা পাঠিয়ে আপনার **TrxID** বা **লাস্ট ৪ ডিজিট** লিখে মেসেজ দিন। সাথে সাথে টপ-আপ প্রসেস শুরু হবে! ⚡`,
        buttons: [
          { id: 'btn_payment', title: '💳 পেমেন্ট নাম্বার' },
          { id: 'btn_catalog', title: '💎 UC প্রাইস লিস্ট' },
          { id: 'btn_website', title: '🌐 ওয়েবসাইট ২% ছাড়' }
        ]
      };
    }

    // 7. Default Welcome Greeting
    return {
      text: `👋 আসসালামু আলাইকুম! **DS Dukan**-এ আপনাকে স্বাগতম। 🎮✨\n\nআমরা সবথেকে দ্রুত ও নির্ভরযোগ্যভাবে PUBG Mobile UC, Growth Pack এবং Prime মেম্বারশিপ টপ-আপ করে থাকি (ডেলিভারি ৫-১৫ মিনিট, শুধুমাত্র UID প্রয়োজন)।\n\n🎁 [ওয়েবসাইট থেকে কিনলে পাচ্ছেন ২% অটো ডিসকাউন্ট: https://www.dsdukan.com/#]\n\nনিচের অপশনগুলো থেকে বেছে নিন অথবা প্যাকেজের নাম লিখে মেসেজ দিন:`,
      buttons: [
        { id: 'btn_catalog', title: '💎 UC প্রাইস লিস্ট' },
        { id: 'btn_growth', title: '📦 Growth Pack' },
        { id: 'btn_payment', title: '💳 পেমেন্ট নাম্বার' }
      ]
    };
  }
}

export const langChainAgent = new LangChainAgentService();

