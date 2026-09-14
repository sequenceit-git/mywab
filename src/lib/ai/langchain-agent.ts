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
    const cleanQuery = query.toLowerCase();

    const matches = products.filter(
      p =>
        p.name_en.toLowerCase().includes(cleanQuery) ||
        p.name_bn.includes(cleanQuery) ||
        p.category.toLowerCase().includes(cleanQuery) ||
        p.sku.toLowerCase().includes(cleanQuery)
    );

    if (matches.length === 0) {
      return JSON.stringify({
        found: false,
        message: 'No exact product matched the query.',
        available_products: products.map(p => ({
          sku: p.sku,
          name_en: p.name_en,
          name_bn: p.name_bn,
          price: p.price,
          stock: p.stock_qty
        }))
      });
    }

    return JSON.stringify({
      found: true,
      results: matches.map(p => ({
        sku: p.sku,
        name_en: p.name_en,
        name_bn: p.name_bn,
        price: `৳${p.price}`,
        in_stock: p.stock_qty > 0,
        stock_qty: p.stock_qty,
        description_bn: p.description_bn,
        description_en: p.description_en
      }))
    });
  },
  {
    name: 'search_catalog',
    description: 'Search for products, prices, stock availability, and descriptions in the store catalog (Bangla/English).',
    schema: z.object({
      query: z.string().describe('Product name, category, or keyword to search for (e.g. "t-shirt", "পোলো শার্ট", "shoes")')
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
    description: 'Get answers to common store questions such as delivery charges, delivery timeframe, payment methods, and return/exchange policy.',
    schema: z.object({
      topic: z.string().describe('Topic or question keyword (e.g. "delivery charge", "ডেলিভারি", "payment", "return")')
    })
  }
);

export const updateDraftOrderTool = tool(
  async (params: {
    conversationId?: string;
    customerPhone?: string;
    customerName?: string;
    deliveryAddress?: string;
    items?: Array<{ skuOrName: string; quantity: number }>;
    customerNotes?: string;
  }) => {
    const convId = params.conversationId || 'default';
    const currentState = db.getSessionState(convId);

    const mergedItems = params.items && params.items.length > 0
      ? params.items
      : currentState.draftOrder.items;

    const mergedName = params.customerName || currentState.draftOrder.customerName;
    const mergedAddress = params.deliveryAddress || currentState.draftOrder.deliveryAddress;
    const mergedPhone = params.customerPhone || currentState.draftOrder.customerPhone;
    const mergedNotes = params.customerNotes || currentState.draftOrder.customerNotes;

    const hasItems = mergedItems && mergedItems.length > 0;
    const hasName = Boolean(mergedName && mergedName.trim());
    const hasAddress = Boolean(mergedAddress && mergedAddress.trim());
    const hasPhone = Boolean(mergedPhone && mergedPhone.trim());

    let determinedStep: 'IDLE' | 'COLLECTING_DETAILS' | 'AWAITING_CONFIRMATION' = 'COLLECTING_DETAILS';
    if (hasItems && hasName && hasAddress && hasPhone) {
      determinedStep = 'AWAITING_CONFIRMATION';
    } else if (!hasItems && !hasName && !hasAddress && !hasPhone) {
      determinedStep = 'IDLE';
    }

    const updatedState = db.setSessionState(convId, {
      step: determinedStep,
      draftOrder: {
        items: mergedItems,
        customerName: mergedName,
        deliveryAddress: mergedAddress,
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
        ? 'All order details gathered! Present a final order summary card to the customer and ask for their final confirmation.'
        : 'Draft details updated in session memory.'
    });
  },
  {
    name: 'update_draft_order',
    description: 'Save or update customer order details (products, customer name, delivery address, phone) to session memory as the conversation progresses.',
    schema: z.object({
      conversationId: z.string().nullable().optional().describe('The current conversation ID'),
      customerPhone: z.string().nullable().optional().describe('Customer contact phone number'),
      customerName: z.string().nullable().optional().describe('Customer full name'),
      deliveryAddress: z.string().nullable().optional().describe('Customer delivery address (House/Road/Area/District)'),
      items: z.array(
        z.object({
          skuOrName: z.string().describe('Product SKU or name'),
          quantity: z.number().describe('Quantity of items')
        })
      ).nullable().optional().describe('List of ordered items'),
      customerNotes: z.string().nullable().optional().describe('Customer notes')
    })
  }
);

export const createOrderTool = tool(
  async (params: {
    customerPhone: string;
    customerName: string;
    deliveryAddress: string;
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
          delivery_phone: recentOrder.delivery_phone,
          delivery_address: recentOrder.delivery_address.address,
          status: recentOrder.status,
          message: `Order #${recentOrder.order_id} has ALREADY been created and confirmed just moments ago. DO NOT CREATE ANOTHER ORDER. Reassure the customer that order #${recentOrder.order_id} is already placed and confirmed.`
        });
      }

      // 1. Resolve customer
      const user = await db.getOrCreateUser(params.customerPhone, params.customerName, params.deliveryAddress);

      // 2. Resolve items with pricing from catalog
      const allProducts = await db.getProducts();
      const resolvedItems: Array<{ product_id?: string; product_name: string; unit_price: number; quantity: number }> = [];

      for (const item of params.items) {
        const found = allProducts.find(
          p =>
            p.sku.toLowerCase() === item.skuOrName.toLowerCase() ||
            p.name_en.toLowerCase().includes(item.skuOrName.toLowerCase()) ||
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
          resolvedItems.push({
            product_name: item.skuOrName,
            unit_price: 500,
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
        deliveryAddress: {
          name: params.customerName,
          phone: params.customerPhone,
          address: params.deliveryAddress
        },
        deliveryPhone: params.customerPhone,
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
        delivery_phone: order.delivery_phone,
        delivery_address: order.delivery_address.address,
        message: 'Order created successfully and forwarded to worker dispatch team.'
      });
    } catch (err) {
      return JSON.stringify({ success: false, error: String(err) });
    }
  },
  {
    name: 'create_order',
    description: 'Create a NEW confirmed order for the customer. ONLY invoke this when placing a brand new order, NEVER when customer asks if an order is confirmed or inquires about status.',
    schema: z.object({
      customerPhone: z.string().describe('Customer phone number (e.g. +88017XXXXXXXX)'),
      customerName: z.string().describe('Full name of the customer'),
      deliveryAddress: z.string().describe('Detailed delivery address (House, Road, Area, City)'),
      items: z.array(
        z.object({
          skuOrName: z.string().describe('Product SKU or name (e.g. TSHIRT-BLK-M or "প্রিমিয়াম কটন টি-শার্ট")'),
          quantity: z.number().describe('Quantity of items')
        })
      ).describe('List of ordered items'),
      customerNotes: z.string().nullable().optional().describe('Any special customer instructions (e.g. "Call before delivery")'),
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
- Draft Product(s): ${draft.items && draft.items.length > 0 ? draft.items.map(i => `${i.skuOrName} (Qty: ${i.quantity})`).join(', ') : 'None currently in draft'}
- Customer Name: ${draft.customerName || 'Not yet provided'}
- Delivery Address: ${draft.deliveryAddress || 'Not yet provided'}
- Contact Phone: ${draft.customerPhone || customerPhone || 'Not yet provided'}
- Last Placed Order ID: ${sessionState.lastOrderId || 'None'}
`;

    const placedNotice = sessionState.lastOrderId
      ? `\nIMPORTANT NOTICE ON RECENT ORDER:\nOrder #${sessionState.lastOrderId} was ALREADY PLACED AND CONFIRMED in this session. If customer asks "Confirm hoyese?", "Is it confirmed?", or inquires about status, confirm to them that Order #${sessionState.lastOrderId} is confirmed and currently being processed. DO NOT re-ask for details and DO NOT say it is not confirmed.\n`
      : '';

    return `You are "WapBot", the intelligent, friendly, and helpful WhatsApp AI shopping assistant for WapBusiness.
Current Customer Phone: ${customerPhone}

${draftInfo}${placedNotice}
YOUR ORDERING LIFECYCLE & STATE RULES:
1. Help customers inquire about products, pricing, stock, colors, sizes, and store policies using \`search_catalog\` and \`get_faq\`.
2. Provide answers in fluent Bengali (বাংলা) by default, or English/Banglish if the customer prefers.
3. When customer specifies product(s), name, address, or phone number:
   - Call \`update_draft_order\` to save these details into active session state.
4. When all 4 slots (Products, Customer Name, Delivery Address, Phone) are gathered:
   - Present a clear, friendly Order Verification Summary in Bengali and ask if they would like to place/confirm the order.
5. CRITICAL MULTI-TURN CONFIRMATION (EXTREMELY IMPORTANT):
   - When Step is "AWAITING_CONFIRMATION" or all details exist in the Active Session State above, and the customer replies with ANY confirmation (e.g. "Yes", "Yes all okey", "Okay", "Confirm", "Please proceed", "হ্যাঁ", "কনফার্ম করুন", "ঠিক আছে", "অর্ডার দিন", "হ্যাঁ এগিয়ে যান"):
     -> IMMEDIATELY invoke \`create_order\` using the details from the Active Session State!
     -> NEVER ask the customer to re-enter their name, address, or phone number if it is already present in the active session state!
6. ANTI-DUPLICATE RULES:
   - If an order was already placed (Last Placed Order ID is present or step is ORDER_PLACED) and customer asks "Confirm hoyese?", "Is it confirmed?", "Status ki?", etc., reassure them using their Order ID. DO NOT call \`create_order\` again!
   - ONLY call \`create_order\` when the customer explicitly specifies they want to buy additional/new items in a separate new order.
7. Answers & FAQs:
   - Delivery charges: Inside Dhaka ৳60 (24-48 hrs), Outside Dhaka ৳120 (2-4 days).
   - Payment methods: Cash on Delivery (COD), bKash, Nagad.

CONVERSATIONAL RULES:
- Be polite, concise, and natural for WhatsApp messaging.
- Use emojis tastefully (🛍️, 📦, 🚚, ✨).
- Always format prices with ৳ symbol (e.g. ৳৪৫০ / ৳450).`;
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
    // If we are awaiting confirmation or have all 4 slots filled, and customer gives an affirmative reply:
    const isAffirmative = [
      'yes', 'yes all okey', 'yes all ok', 'all okey', 'all ok', 'okey', 'ok', 'okay',
      'confirm', 'confirmed', 'plz confirm', 'please confirm', 'proceed', 'done',
      'thik ase', 'thik ache', 'thik', 'yes please', 'yes go ahead',
      'হ্যাঁ', 'হ্যা', 'ঠিক আছে', 'কনফার্ম', 'কনফার্ম করুন', 'অর্ডার করুন', 'অর্ডার দিন', 'এগিয়ে যান', 'অর্ডার কনফার্ম'
    ].some(phrase => lowerMessage === phrase || lowerMessage.startsWith(phrase));

    const hasAllSlots = Boolean(
      draft.items && draft.items.length > 0 &&
      draft.customerName &&
      draft.deliveryAddress
    );

    if ((sessionState.step === 'AWAITING_CONFIRMATION' || hasAllSlots) && isAffirmative) {
      console.log(`[AI Fast-Path] Affirmative response received in state ${sessionState.step}. Placing order directly...`);
      const targetPhone = draft.customerPhone || phone;
      const targetName = draft.customerName || 'Customer';
      const targetAddress = draft.deliveryAddress || 'Address not specified';
      const targetItems = draft.items && draft.items.length > 0 ? draft.items : [{ skuOrName: 'Classic Polo Shirt', quantity: 1 }];

      const toolResultRaw = await createOrderTool.invoke({
        customerPhone: targetPhone,
        customerName: targetName,
        deliveryAddress: targetAddress,
        items: targetItems,
        customerNotes: draft.customerNotes,
        conversationId
      });

      const toolResult = JSON.parse(toolResultRaw);
      if (toolResult.success) {
        const text = 
`🎉 *অর্ডার সফলভাবে নিশ্চিত করা হয়েছে!*

📦 *Order ID:* \`${toolResult.order_id}\`
💰 *মোট মূল্য:* ৳${toolResult.total_amount}
👤 *নাম:* ${targetName}
📍 *ডেলিভারি ঠিকানা:* ${toolResult.delivery_address}
📞 *ফোন নম্বর:* ${toolResult.delivery_phone}

আপনার অর্ডারটি আমাদের ডেলিভারি টিমের কাছে পাঠানো হয়েছে। খুব দ্রুত আপনার সাথে যোগাযোগ করা হবে! 🚚✨`;

        const buttons: WhatsAppButton[] = [
          { id: `track:${toolResult.order_id}`, title: '📦 অর্ডার ট্র্যাক' },
          { id: 'btn_catalog', title: '🛍️ আরও পণ্য' },
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
    if (lowerReply.includes('order id') || lowerReply.includes('নিশ্চিত করা হয়েছে') || lowerReply.includes('সফলভাবে') || lowerReply.includes('wap-')) {
      return [
        { id: 'btn_track', title: '📦 অর্ডার ট্র্যাক' },
        { id: 'btn_catalog', title: '🛍️ আরও পণ্য' },
        { id: 'btn_support', title: '👤 প্রতিনিধি' }
      ];
    }

    // If verification summary card is presented (Awaiting confirmation)
    if (
      lowerReply.includes('যাচাই করুন') ||
      lowerReply.includes('নিশ্চিত করার জন্য') ||
      lowerReply.includes('এগিয়ে যেতে পারি') ||
      lowerReply.includes('অর্ডারটি তৈরি করতে') ||
      sessionState?.step === 'AWAITING_CONFIRMATION'
    ) {
      return [
        { id: 'btn_confirm_order', title: '✅ কনফার্ম করুন' },
        { id: 'btn_catalog', title: '🛍️ আরও পণ্য' },
        { id: 'btn_support', title: '👤 সহায়তা' }
      ];
    }

    if (lowerUser.includes('পণ্য') || lowerUser.includes('catalog') || lowerUser.includes('টি-শার্ট') || lowerUser.includes('পোলো')) {
      return [
        { id: 'btn_order_now', title: '⚡ অর্ডার করতে চাই' },
        { id: 'btn_delivery', title: '🚚 ডেলিভারি চার্জ' },
        { id: 'btn_payment', title: '💳 পেমেন্ট নিয়ম' }
      ];
    }

    if (lowerUser.includes('ডেলিভারি') || lowerUser.includes('charge') || lowerUser.includes('পেমেন্ট')) {
      return [
        { id: 'btn_catalog', title: '🛍️ পণ্য তালিকা' },
        { id: 'btn_cod', title: '💵 Cash On Delivery' },
        { id: 'btn_order_now', title: '⚡ অর্ডার করুন' }
      ];
    }

    return [
      { id: 'btn_catalog', title: '🛍️ পণ্য তালিকা' },
      { id: 'btn_delivery', title: '🚚 ডেলিভারি তথ্য' },
      { id: 'btn_order_now', title: '⚡ অর্ডার করুন' }
    ];
  }

  /**
   * Fast rule-based heuristic fallback engine with rich buttons
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
      lower.includes('wap-') ||
      lower.includes('hoyese') ||
      lower.includes('হয়েছে')
    ) {
      const match = text.match(/WAP-\d{8}-\d{4}/i);
      let order = null;
      if (match) {
        order = await db.getOrderByCode(match[0].toUpperCase());
      } else {
        const recentOrders = await db.getOrdersByPhone(phone);
        order = recentOrders[0] || null;
      }

      if (order) {
        return {
          text: `🎉 *অর্ডার নিশ্চিতকরণ ও স্ট্যাটাস*\n\nপ্রিয় গ্রাহক, আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে।\n\n📦 *Order ID:* \`${order.order_id}\`\n📊 *বর্তমান স্ট্যাটাস:* *${order.status}*\n💰 *মোট মূল্য:* ৳${order.total_amount}\n📍 *ডেলিভারি ঠিকানা:* ${order.delivery_address?.address || 'N/A'}\n\nআমাদের ডেলিভারি টিম খুব দ্রুত আপনার সাথে যোগাযোগ করবে! 🚚✨`,
          buttons: [
            { id: `track:${order.order_id}`, title: '📦 অর্ডার ট্র্যাক' },
            { id: 'btn_catalog', title: '🛍️ আরও পণ্য' },
            { id: 'btn_support', title: '👤 কাস্টমার কেয়ার' }
          ]
        };
      }
    }

    // 2. Delivery FAQ
    if (lower.includes('delivery') || lower.includes('ডেলিভারি') || lower.includes('charge') || lower.includes('চার্জ')) {
      return {
        text: `🚚 *ডেলিভারি সংক্রান্ত তথ্য:*\n\n• ঢাকার ভেতরে ডেলিভারি চার্জ: *৬০ টাকা* (২৪-৪৮ ঘন্টা)\n• ঢাকার বাইরে ডেলিভারি চার্জ: *১২০ টাকা* (২-৪ দিন)\n\nআমরা ক্যাশ অন ডেলিভারি (COD) এবং বিকাশ/নগদে পেমেন্ট গ্রহণ করি।`,
        buttons: [
          { id: 'btn_catalog', title: '🛍️ পণ্য তালিকা' },
          { id: 'btn_payment', title: '💳 পেমেন্ট পদ্ধতি' },
          { id: 'btn_order_now', title: '⚡ অর্ডার করুন' }
        ]
      };
    }

    // 3. Payment FAQ
    if (lower.includes('payment') || lower.includes('পেমেন্ট') || lower.includes('bkash') || lower.includes('বিকাশ')) {
      return {
        text: `💳 *পেমেন্ট মেথড:*\n\n১. ক্যাশ অন ডেলিভারি (Cash on Delivery)\n২. বিকাশ (bKash)\n৩. নগদ (Nagad)\n\nপণ্য হাতে পেয়ে মূল্য পরিশোধের সুযোগ রয়েছে!`,
        buttons: [
          { id: 'btn_catalog', title: '🛍️ পণ্য তালিকা' },
          { id: 'btn_delivery', title: '🚚 ডেলিভারি চার্জ' },
          { id: 'btn_order_now', title: '⚡ অর্ডার করুন' }
        ]
      };
    }

    // 4. Product Catalog
    if (lower.includes('t-shirt') || lower.includes('টি-শার্ট') || lower.includes('shirt') || lower.includes('পোলো') || lower.includes('প্রোডাক্ট') || lower.includes('দাম') || lower.includes('catalog') || lower.includes('পণ্য')) {
      const products = await db.getProducts();
      const productList = products.map(p => `• *${p.name_bn}* (${p.name_en})\n  মূল্য: *৳${p.price}* | স্টক: ${p.stock_qty > 0 ? '✅ আছে' : '❌ শেষ'}`).join('\n\n');
      return {
        text: `🛍️ *আমাদের বর্তমান পণ্য তালিকা ও মূল্য:*\n\n${productList}\n\nঅর্ডার করতে আপনার নাম, পণ্যের নাম, ঠিকানা ও ফোন নম্বর লিখে পাঠান!`,
        buttons: [
          { id: 'btn_order_polo', title: '👕 Polo Shirt অর্ডার' },
          { id: 'btn_order_tshirt', title: '👔 T-Shirt অর্ডার' },
          { id: 'btn_delivery', title: '🚚 ডেলিভারি চার্জ' }
        ]
      };
    }

    // 5. Complete Order Placer (Only if name AND address explicitly provided AND no order created in last 5 min)
    if (
      (lower.includes('নাম') && lower.includes('ঠিকানা')) ||
      (lower.includes('name:') && lower.includes('address:'))
    ) {
      const recentOrders = await db.getOrdersByPhone(phone);
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const recentOrder = recentOrders.find(o => new Date(o.created_at).getTime() > fiveMinutesAgo);

      if (recentOrder) {
        return {
          text: `🎉 প্রিয় গ্রাহক, আপনার অর্ডারটি (\`${recentOrder.order_id}\`) ইতিমধ্যে তৈরি করা হয়েছে।\n\n💰 মোট মূল্য: ৳${recentOrder.total_amount}\n📍 ঠিকানা: ${recentOrder.delivery_address?.address}\n\nআমাদের টিম শীঘ্রই ডেলিভারির জন্য যোগাযোগ করবে!`,
          buttons: [
            { id: `track:${recentOrder.order_id}`, title: '📦 অর্ডার ট্র্যাক' },
            { id: 'btn_catalog', title: '🛍️ আরও পণ্য' },
            { id: 'btn_support', title: '👤 সহায়তা' }
          ]
        };
      }

      const nameMatch = text.match(/(?:নাম|name)[:\s]+([^,\n]+)/i);
      const addressMatch = text.match(/(?:ঠিকানা|address)[:\s]+([^,\n]+)/i);

      if (nameMatch && addressMatch) {
        const customerName = nameMatch[1].trim();
        const address = addressMatch[1].trim();

        const products = await db.getProducts();
        const chosenProduct = products[0] || { id: 'prod-1', name_bn: 'Classic Polo Shirt', name_en: 'Classic Polo Shirt', price: 650 };

        const user = await db.getOrCreateUser(phone, customerName, address);
        const order = await db.createOrder({
          userId: user.id,
          items: [{
            product_id: chosenProduct.id,
            product_name: chosenProduct.name_bn || chosenProduct.name_en,
            unit_price: Number(chosenProduct.price),
            quantity: 1
          }],
          deliveryAddress: {
            name: customerName,
            phone,
            address
          },
          deliveryPhone: phone,
          customerNotes: 'Created via WhatsApp Smart Assistant'
        });

        await telegramBot.dispatchNewOrder(order);
        db.clearSessionDraft(conversationId, order.order_id);

        return {
          text: `🎉 *ধন্যবাদ! আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে।*\n\n📦 *Order ID:* \`${order.order_id}\`\n💰 *মোট মূল্য:* ৳${order.total_amount}\n👤 *নাম:* ${customerName}\n📍 *ঠিকানা:* ${address}\n\nআমাদের ডেলিভারি টিম দ্রুত ডেলিভারি করার জন্য কাজ করছে! 🚀`,
          buttons: [
            { id: `track:${order.order_id}`, title: '📦 অর্ডার ট্র্যাক' },
            { id: 'btn_catalog', title: '🛍️ আরও পণ্য' },
            { id: 'btn_support', title: '👤 সহায়তা' }
          ],
          createdOrder: order
        };
      }
    }

    // 6. Default Welcome Greeting
    return {
      text: `👋 আসসালামু আলাইকুম! WapBusiness-এ আপনাকে স্বাগতম।\n\nআমরা প্রিমিয়াম কোয়ালিটির পোশাক ও পণ্য দ্রুত ডেলিভারি করে থাকি। আপনি নিচের অপশনগুলো থেকে বেছে নিতে পারেন অথবা সরাসরি পণ্যের নাম লিখে মেসেজ দিতে পারেন:`,
      buttons: [
        { id: 'btn_catalog', title: '🛍️ পণ্য তালিকা' },
        { id: 'btn_delivery', title: '🚚 ডেলিভারি চার্জ' },
        { id: 'btn_order_now', title: '⚡ দ্রুত অর্ডার' }
      ]
    };
  }
}

export const langChainAgent = new LangChainAgentService();
