import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { db } from '@/lib/db';
import { telegramBot } from '@/lib/telegram/bot';

export const getFaqTool = tool(
  async ({ topic }: { topic: string }) => {
    const faqs = await db.getFAQs();
    const cleanTopic = topic.toLowerCase();

    const matched = faqs.filter(
      f =>
        f.question_en.toLowerCase().includes(cleanTopic) ||
        f.question_bn.toLowerCase().includes(cleanTopic) ||
        f.answer_en.toLowerCase().includes(cleanTopic) ||
        f.answer_bn.toLowerCase().includes(cleanTopic) ||
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
    description: 'Look up answered Q&As from the store knowledgebase for any customer questions, inquiries about delivery time, account safety, login requirements, trust, payment accounts, website discounts, or store policies.',
    schema: z.object({
      topic: z.string().describe('Search keyword or question topic (e.g. "delivery time", "is it safe", "login required", "payment accounts", "website discount", "instructions")')
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
    } else if (hasItems && !hasUid) {
      determinedStep = 'COLLECTING_DETAILS';
    }

    const updatedState = db.setSessionState(convId, {
      step: determinedStep,
      draftOrder: {
        items: mergedItems,
        customerName: mergedName,
        playerUid: mergedUid,
        paymentMethod: mergedPaymentMethod,
        trxId: mergedTrxId,
        customerPhone: mergedPhone,
        customerNotes: mergedNotes
      }
    });

    return JSON.stringify({
      success: true,
      message: 'Draft order session state updated successfully',
      currentState: updatedState
    });
  },
  {
    name: 'update_draft_order',
    description: 'Save or update the customer draft order details into active conversation memory as slots are collected (Player UID, selected package, TrxID, payment method).',
    schema: z.object({
      conversationId: z.string().optional().nullable().describe('Active conversation ID'),
      customerPhone: z.string().optional().nullable().describe('Customer contact phone number'),
      customerName: z.string().optional().nullable().describe('Customer name or in-game name'),
      playerUid: z.string().optional().nullable().describe('PUBG Player UID (e.g. 5123456789)'),
      paymentMethod: z.string().optional().nullable().describe('Payment method (BKASH, NAGAD, ROCKET)'),
      trxId: z.string().optional().nullable().describe('Transaction ID or sender last 4 digits'),
      items: z.array(
        z.object({
          skuOrName: z.string().describe('Product SKU or name (e.g. 60 UC, 385 UC, Prime)'),
          quantity: z.number().describe('Quantity of items')
        })
      ).optional().nullable().describe('Items selected by customer'),
      customerNotes: z.string().optional().nullable().describe('Special customer notes')
    })
  }
);

export const createOrderTool = tool(
  async (params: {
    customerPhone: string;
    customerName: string;
    playerUid?: string | null;
    trxId?: string | null;
    paymentMethod?: string | null;
    items: Array<{ skuOrName: string; quantity: number }>;
    customerNotes?: string | null;
    conversationId?: string | null;
  }) => {
    try {
      // 1. Get or create the customer record
      const user = await db.getOrCreateUser(
        params.customerPhone,
        params.customerName,
        params.playerUid ? `PUBG UID: ${params.playerUid}` : undefined
      );

      // 2. Resolve items against the fixed top-up catalog
      const TOPUP_CATALOG = [
        { sku: '60 UC', name: '৬০ ইউসি (60 UC)', price: 115 },
        { sku: '120 UC', name: '১২০ ইউসি (120 UC)', price: 230 },
        { sku: '180 UC', name: '১৮০ ইউসি (180 UC)', price: 340 },
        { sku: '325 UC', name: '৩২৫ ইউসি (325 UC)', price: 600 },
        { sku: '385 UC', name: '৩৮৫ ইউসি [50 RP]', price: 710 },
        { sku: '660 UC', name: '৬৬০ ইউসি (660 UC)', price: 1150 },
        { sku: '720 UC', name: '৭২০ ইউসি [100 RP]', price: 1250 },
        { sku: '1045 UC', name: '১০৪৫ ইউসি (1045 UC)', price: 1850 },
        { sku: 'Growth Pack 1', name: 'Growth Pack 1', price: 150 },
        { sku: 'Growth Pack 2', name: 'Growth Pack 2', price: 390 },
        { sku: 'Growth Pack 3', name: 'Growth Pack 3', price: 590 },
        { sku: 'Prime', name: 'Prime 1 Month', price: 150 },
        { sku: 'Prime Plus', name: 'Prime Plus 1 Month', price: 1150 }
      ];

      const resolvedItems = [];
      for (const item of params.items) {
        const itemLower = item.skuOrName.toLowerCase();
        const numMatch = itemLower.match(/\d+/)?.[0];

        let found = TOPUP_CATALOG.find(
          p => p.sku.toLowerCase() === itemLower || p.name.toLowerCase() === itemLower
        );

        if (!found && numMatch) {
          found = TOPUP_CATALOG.find(
            p => p.sku.includes(numMatch) || p.name.includes(numMatch)
          );
        }

        if (!found) {
          found = TOPUP_CATALOG.find(
            p => itemLower.includes(p.sku.toLowerCase()) || p.sku.toLowerCase().includes(itemLower)
          );
        }

        if (found) {
          resolvedItems.push({
            product_name: found.name,
            unit_price: found.price,
            quantity: item.quantity || 1
          });
        } else {
          resolvedItems.push({
            product_name: item.skuOrName,
            unit_price: 115,
            quantity: item.quantity || 1
          });
        }
      }

      if (resolvedItems.length === 0) {
        return JSON.stringify({ success: false, error: 'No valid products could be resolved.' });
      }

      // 3. Create the Order in Central Database (Fallback to draft session state if parameter was omitted by LLM)
      const draft = params.conversationId ? db.getSessionState(params.conversationId).draftOrder : null;
      const effectiveUid = (params.playerUid && params.playerUid.trim()) || draft?.playerUid || undefined;
      const effectiveTrx = (params.trxId && params.trxId.trim()) || draft?.trxId || undefined;
      const effectivePayment = (params.paymentMethod && params.paymentMethod.trim()) || draft?.paymentMethod || undefined;
      const effectiveNotes = (params.customerNotes && params.customerNotes.trim()) || draft?.customerNotes || undefined;

      if (!effectiveTrx) {
        return JSON.stringify({
          success: false,
          error: 'Payment TrxID or confirmation is required before creating a confirmed top-up order. Use update_draft_order to store the UID/package and request payment from the customer.'
        });
      }

      const order = await db.createOrder({
        userId: user.id,
        items: resolvedItems,
        deliveryPhone: params.customerPhone,
        playerUid: effectiveUid,
        trxId: effectiveTrx,
        paymentMethod: effectivePayment,
        customerNotes: effectiveNotes
      });

      // 4. Automatically Forward to Telegram Worker Group
      await telegramBot.dispatchNewOrder(order);

      // 5. Update Customer Persistent Memory Profile (Saved UIDs, Preferred Payment)
      if (effectiveUid) {
        db.updateCustomerProfile(params.customerPhone, {
          last_used_uid: effectiveUid,
          preferred_payment: effectivePayment || 'bKash'
        }).catch(err => console.error('[Memory] Error updating customer profile:', err));
      }

      // 6. Clear the active draft session state
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
    return JSON.stringify({
      count: orders.length,
      orders: orders.slice(0, 5).map(o => ({
        order_id: o.order_id,
        status: o.status,
        total_amount: `৳${o.total_amount}`,
        created_at: o.created_at,
        worker: o.current_worker ? o.current_worker.full_name : 'Unassigned'
      }))
    });
  },
  {
    name: 'get_customer_orders',
    description: 'Retrieve previous orders for the current customer phone number.',
    schema: z.object({
      customerPhone: z.string().describe('Customer phone number')
    })
  }
);
