import { supabase, supabaseAdmin, isSupabaseConfigured } from './supabase/client';
import {
  UserProfile,
  Product,
  FAQ,
  Order,
  Worker,
  OrderAssignment,
  Conversation,
  ConversationSessionState,
  Message,
  Payment,
  OrderStatus
} from '@/types';

const getDbClient = () => supabaseAdmin || supabase;

// Clean in-memory fallback store used only when Supabase is not configured
class MockDatabaseStore {
  users: Map<string, UserProfile> = new Map();
  products: Map<string, Product> = new Map();
  faqs: Map<string, FAQ> = new Map();
  orders: Map<string, Order> = new Map();
  workers: Map<string, Worker> = new Map();
  assignments: Map<string, OrderAssignment> = new Map();
  conversations: Map<string, Conversation> = new Map();
  messages: Map<string, Message> = new Map();
  payments: Map<string, Payment> = new Map();
  sessionStates: Map<string, ConversationSessionState> = new Map();
}

// Global Singleton for in-memory store in dev
const globalForStore = global as unknown as { mockStore?: MockDatabaseStore };
export const mockStore = globalForStore.mockStore || new MockDatabaseStore();
if (process.env.NODE_ENV !== 'production') globalForStore.mockStore = mockStore;

// Central Database Service Facade
export const db = {
  // PRODUCTS
  async getProducts(): Promise<Product[]> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { data, error } = await client
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) return data;
      if (error) console.error('Supabase getProducts error:', error);
      return [];
    }
    return Array.from(mockStore.products.values());
  },

  async getProductBySku(sku: string): Promise<Product | null> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { data, error } = await client
        .from('products')
        .select('*')
        .eq('sku', sku)
        .single();
      if (!error && data) return data;
      return null;
    }
    for (const p of mockStore.products.values()) {
      if (p.sku.toLowerCase() === sku.toLowerCase()) return p;
    }
    return null;
  },

  async saveProduct(product: Partial<Product>): Promise<Product> {
    const id = product.id || crypto.randomUUID();
    const newProd: Product = {
      id,
      sku: product.sku || `SKU-${Date.now()}`,
      name_en: product.name_en || '',
      name_bn: product.name_bn || '',
      description_en: product.description_en || null,
      description_bn: product.description_bn || null,
      price: Number(product.price) || 0,
      stock_qty: Number(product.stock_qty) || 0,
      category: product.category || 'General',
      is_active: product.is_active !== undefined ? product.is_active : true,
      created_at: new Date().toISOString()
    };

    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { error } = await client.from('products').upsert(newProd);
      if (error) console.error('Supabase saveProduct error:', error);
    } else {
      mockStore.products.set(id, newProd);
    }
    return newProd;
  },

  // FAQS
  async getFAQs(): Promise<FAQ[]> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { data, error } = await client
        .from('faqs')
        .select('*')
        .eq('is_active', true);
      if (!error && data) return data;
      if (error) console.error('Supabase getFAQs error:', error);
      return [];
    }
    return Array.from(mockStore.faqs.values()).filter(f => f.is_active);
  },

  // USERS / CUSTOMERS
  async getOrCreateUser(phone: string, name?: string, address?: string): Promise<UserProfile> {
    const cleanPhone = phone.trim();
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { data } = await client
        .from('users')
        .select('*')
        .eq('phone_number', cleanPhone)
        .single();
      
      if (data) {
        if (name && !data.name) {
          await client.from('users').update({ name, updated_at: new Date().toISOString() }).eq('id', data.id);
        }
        return data;
      }
      const newUser: UserProfile = {
        id: crypto.randomUUID(),
        phone_number: cleanPhone,
        name: name || null,
        address_profile: address ? { full_address: address } : {},
        language_pref: 'bn',
        status_tag: 'REGULAR',
        created_at: new Date().toISOString()
      };
      await client.from('users').insert(newUser);
      return newUser;
    }

    for (const u of mockStore.users.values()) {
      if (u.phone_number === cleanPhone) {
        if (name && !u.name) u.name = name;
        if (address && !u.address_profile.full_address) u.address_profile.full_address = address;
        return u;
      }
    }

    const newUser: UserProfile = {
      id: `user-${Date.now()}`,
      phone_number: cleanPhone,
      name: name || null,
      address_profile: address ? { full_address: address } : {},
      language_pref: 'bn',
      status_tag: 'REGULAR',
      created_at: new Date().toISOString()
    };
    mockStore.users.set(newUser.id, newUser);
    return newUser;
  },

  async getUserById(id: string): Promise<UserProfile | null> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { data } = await client.from('users').select('*').eq('id', id).single();
      if (data) return data;
      return null;
    }
    return mockStore.users.get(id) || null;
  },

  async getAllUsers(): Promise<UserProfile[]> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { data, error } = await client.from('users').select('*').order('created_at', { ascending: false });
      if (!error && data) return data;
      if (error) console.error('Supabase getAllUsers error:', error);
      return [];
    }
    return Array.from(mockStore.users.values());
  },

  // ORDERS
  async createOrder(params: {
    userId: string;
    items: Array<{ product_id?: string; product_name: string; unit_price: number; quantity: number }>;
    deliveryAddress: { name?: string; phone?: string; address: string; city?: string; area?: string; notes?: string };
    deliveryPhone: string;
    customerNotes?: string | null;
  }): Promise<Order> {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    const orderIdCode = `WAP-${todayStr}-${randomSeq}`;
    const orderUuid = crypto.randomUUID();

    const totalAmount = params.items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

    const user = await this.getUserById(params.userId);

    const order: Order = {
      id: orderUuid,
      order_id: orderIdCode,
      user_id: params.userId,
      total_amount: totalAmount,
      status: 'PENDING_CLAIM',
      delivery_address: params.deliveryAddress,
      delivery_phone: params.deliveryPhone,
      customer_notes: params.customerNotes || undefined,
      created_at: new Date().toISOString(),
      customer: user || undefined,
      items: params.items.map((item, idx) => ({
        id: crypto.randomUUID(),
        order_id: orderUuid,
        product_id: item.product_id,
        product_name: item.product_name,
        unit_price: item.unit_price,
        quantity: item.quantity,
        subtotal: item.unit_price * item.quantity
      }))
    };

    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { error: orderErr } = await client.from('orders').insert({
        id: order.id,
        order_id: order.order_id,
        user_id: order.user_id,
        total_amount: order.total_amount,
        status: order.status,
        delivery_address: order.delivery_address,
        delivery_phone: order.delivery_phone,
        customer_notes: order.customer_notes
      });
      if (orderErr) console.error('Supabase createOrder error:', orderErr);

      if (order.items && order.items.length > 0) {
        const { error: itemErr } = await client.from('order_items').insert(order.items);
        if (itemErr) console.error('Supabase order_items error:', itemErr);
      }
    } else {
      mockStore.orders.set(order.id, order);
    }

    return order;
  },

  async getOrders(): Promise<Order[]> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { data, error } = await client
        .from('orders')
        .select(`
          *,
          customer:users(*),
          items:order_items(*),
          assignments:order_assignments(*, worker:workers(*))
        `)
        .order('created_at', { ascending: false });
      if (!error && data) {
        // Map assignments to current_worker
        return data.map((o: Order) => {
          const lastAssignment = o.assignments && o.assignments.length > 0 ? o.assignments[o.assignments.length - 1] : null;
          return {
            ...o,
            current_worker: lastAssignment?.worker || undefined
          };
        });
      }
      if (error) console.error('Supabase getOrders error:', error);
      return [];
    }
    return Array.from(mockStore.orders.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  async getOrderByCode(orderIdCode: string): Promise<Order | null> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { data, error } = await client
        .from('orders')
        .select(`
          *,
          customer:users(*),
          items:order_items(*),
          assignments:order_assignments(*, worker:workers(*))
        `)
        .eq('order_id', orderIdCode)
        .single();
      if (!error && data) {
        const lastAssignment = data.assignments && data.assignments.length > 0 ? data.assignments[data.assignments.length - 1] : null;
        return {
          ...data,
          current_worker: lastAssignment?.worker || undefined
        };
      }
      return null;
    }
    for (const o of mockStore.orders.values()) {
      if (o.order_id.toLowerCase() === orderIdCode.toLowerCase()) return o;
    }
    return null;
  },

  async getOrdersByPhone(phone: string): Promise<Order[]> {
    const cleanPhone = phone.trim();
    const digitsOnly = cleanPhone.replace(/\D/g, '');
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { data, error } = await client
        .from('orders')
        .select(`
          *,
          customer:users(*),
          items:order_items(*),
          assignments:order_assignments(*, worker:workers(*))
        `)
        .or(`delivery_phone.eq.${cleanPhone},delivery_phone.eq.${digitsOnly},delivery_phone.eq.+${digitsOnly}`)
        .order('created_at', { ascending: false })
        .limit(5);
      if (!error && data) {
        return data.map((o: Order) => {
          const lastAssignment = o.assignments && o.assignments.length > 0 ? o.assignments[o.assignments.length - 1] : null;
          return {
            ...o,
            current_worker: lastAssignment?.worker || undefined
          };
        });
      }
      if (error) console.error('Supabase getOrdersByPhone error:', error);
      return [];
    }
    return Array.from(mockStore.orders.values())
      .filter(o => o.delivery_phone.replace(/\D/g, '') === digitsOnly)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  // ATOMIC ORDER CLAIM (Double-Claim Prevention)
  async claimOrderAtomic(params: {
    orderIdCode: string;
    telegramUserId: number;
    workerName: string;
    telegramUsername?: string;
  }): Promise<{ success: boolean; message: string; order?: Order; worker?: Worker }> {
    const { orderIdCode, telegramUserId, workerName, telegramUsername } = params;

    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      // 1. Try Supabase RPC Stored Procedure first
      try {
        const { data, error } = await client.rpc('claim_order_atomic', {
          p_order_id_code: orderIdCode,
          p_telegram_user_id: telegramUserId,
          p_worker_name: workerName,
          p_telegram_username: telegramUsername || ''
        });

        if (!error && data && data.success) {
          const fullOrder = await this.getOrderByCode(orderIdCode);
          return { success: true, message: data.message, order: fullOrder || undefined };
        }
        if (data && !data.success && data.message && data.message.includes('already claimed')) {
          return { success: false, message: data.message };
        }
        console.warn('Supabase RPC claim_order_atomic warning/missing, attempting direct query fallback:', error || data);
      } catch (rpcErr) {
        console.warn('Supabase RPC claim_order_atomic threw exception, running direct query fallback:', rpcErr);
      }

      // 2. Direct Supabase Query Fallback
      try {
        // A. Ensure worker exists or register/update
        let workerId: string | null = null;
        let workerObj: Worker | undefined;

        const { data: existingWorker } = await client
          .from('workers')
          .select('*')
          .eq('telegram_user_id', telegramUserId)
          .maybeSingle();

        if (existingWorker) {
          workerId = existingWorker.id;
          workerObj = existingWorker;
          await client
            .from('workers')
            .update({
              full_name: workerName,
              telegram_username: telegramUsername || existingWorker.telegram_username
            })
            .eq('id', existingWorker.id);
        } else {
          const newWorker = {
            id: crypto.randomUUID(),
            telegram_user_id: telegramUserId,
            telegram_username: telegramUsername || null,
            full_name: workerName,
            role: 'WORKER',
            is_active: true,
            created_at: new Date().toISOString()
          };
          const { data: insertedWorker } = await client
            .from('workers')
            .insert(newWorker)
            .select('*')
            .single();

          if (insertedWorker) {
            workerId = insertedWorker.id;
            workerObj = insertedWorker;
          } else {
            workerId = newWorker.id;
            workerObj = newWorker as Worker;
          }
        }

        // B. Fetch order
        const { data: orderData, error: orderErr } = await client
          .from('orders')
          .select('*')
          .eq('order_id', orderIdCode)
          .single();

        if (orderErr || !orderData) {
          return { success: false, message: 'Order not found in database' };
        }

        // Allow claim if PENDING_CLAIM or PENDING_PAYMENT
        if (orderData.status !== 'PENDING_CLAIM' && orderData.status !== 'PENDING_PAYMENT') {
          // Check if already claimed by this same worker
          const { data: lastAssign } = await client
            .from('order_assignments')
            .select('*, worker:workers(*)')
            .eq('order_id', orderData.id)
            .order('claimed_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lastAssign?.worker_id === workerId || lastAssign?.worker?.telegram_user_id === telegramUserId) {
            const fullOrder = await this.getOrderByCode(orderIdCode);
            return {
              success: true,
              message: `You have already claimed order #${orderIdCode}`,
              order: fullOrder || undefined,
              worker: workerObj
            };
          }

          return {
            success: false,
            message: `Order is already in status: ${orderData.status}`
          };
        }

        // C. Update order status to CLAIMED
        await client
          .from('orders')
          .update({ status: 'CLAIMED', updated_at: new Date().toISOString() })
          .eq('id', orderData.id);

        // D. Insert assignment
        if (workerId) {
          await client
            .from('order_assignments')
            .insert({
              id: crypto.randomUUID(),
              order_id: orderData.id,
              worker_id: workerId,
              status: 'CLAIMED',
              claimed_at: new Date().toISOString()
            });
        }

        const fullOrder = await this.getOrderByCode(orderIdCode);
        return {
          success: true,
          message: `Order claimed successfully by ${workerName}`,
          order: fullOrder || undefined,
          worker: workerObj
        };
      } catch (directErr) {
        console.error('Supabase direct order claim error:', directErr);
        return { success: false, message: `Error claiming order: ${String(directErr)}` };
      }
    }

    // In-memory fallback
    const order = await this.getOrderByCode(orderIdCode);
    if (!order) {
      return { success: false, message: 'Order not found' };
    }

    if (order.status !== 'PENDING_CLAIM' && order.status !== 'PENDING_PAYMENT') {
      return {
        success: false,
        message: `Order already claimed or in status: ${order.status}`
      };
    }

    let worker: Worker | undefined;
    for (const w of mockStore.workers.values()) {
      if (w.telegram_user_id === telegramUserId) {
        worker = w;
        break;
      }
    }

    if (!worker) {
      worker = {
        id: `worker-${Date.now()}`,
        telegram_user_id: telegramUserId,
        telegram_username: telegramUsername || null,
        full_name: workerName,
        role: 'WORKER',
        is_active: true,
        created_at: new Date().toISOString(),
        total_completed_orders: 0,
        active_orders: 1
      };
      mockStore.workers.set(worker.id, worker);
    } else {
      worker.active_orders = (worker.active_orders || 0) + 1;
    }

    order.status = 'CLAIMED';
    order.updated_at = new Date().toISOString();
    order.current_worker = worker;

    const assignment: OrderAssignment = {
      id: `assign-${Date.now()}`,
      order_id: order.id,
      worker_id: worker.id,
      status: 'CLAIMED',
      claimed_at: new Date().toISOString(),
      worker: worker
    };

    if (!order.assignments) order.assignments = [];
    order.assignments.push(assignment);
    mockStore.assignments.set(assignment.id, assignment);

    return {
      success: true,
      message: `Order claimed successfully by ${workerName}`,
      order,
      worker
    };
  },

  async updateOrderStatus(orderIdCode: string, status: OrderStatus, workerTelegramId?: number): Promise<{ success: boolean; order?: Order }> {
    const order = await this.getOrderByCode(orderIdCode);
    if (!order) return { success: false };

    order.status = status;
    order.updated_at = new Date().toISOString();

    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      await client
        .from('orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('order_id', orderIdCode);
      
      if (status === 'DELIVERED') {
        await client
          .from('order_assignments')
          .update({ status: 'DELIVERED', completed_at: new Date().toISOString() })
          .eq('order_id', order.id);
      }
    }

    return { success: true, order };
  },

  async updateOrderTelegramMessageId(orderIdCodeOrId: string, messageId: number | null): Promise<void> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      await client
        .from('orders')
        .update({ telegram_message_id: messageId, updated_at: new Date().toISOString() })
        .or(`id.eq.${orderIdCodeOrId},order_id.eq.${orderIdCodeOrId}`);
    }

    for (const o of mockStore.orders.values()) {
      if (o.id === orderIdCodeOrId || o.order_id.toLowerCase() === orderIdCodeOrId.toLowerCase()) {
        o.telegram_message_id = messageId;
        break;
      }
    }
  },

  // WORKERS
  async getWorkers(): Promise<Worker[]> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      try {
        const { data: workers, error } = await client
          .from('workers')
          .select(`
            *,
            assignments:order_assignments(
              id,
              status,
              order:orders(id, status)
            )
          `)
          .order('created_at', { ascending: false });

        if (!error && workers) {
          return workers.map((w: any) => {
            const assignments = Array.isArray(w.assignments) ? w.assignments : [];
            const activeCount = assignments.filter((a: any) => {
              const currentStatus = a.order?.status || a.status;
              return ['CLAIMED', 'PROCESSING', 'OUT_FOR_DELIVERY'].includes(currentStatus);
            }).length;

            const completedCount = assignments.filter((a: any) => {
              const currentStatus = a.order?.status || a.status;
              return currentStatus === 'DELIVERED';
            }).length;

            return {
              id: w.id,
              telegram_user_id: w.telegram_user_id,
              telegram_username: w.telegram_username,
              full_name: w.full_name,
              phone_number: w.phone_number,
              role: w.role,
              is_active: w.is_active,
              created_at: w.created_at,
              active_orders: activeCount,
              total_completed_orders: completedCount
            };
          });
        }
        if (error) console.error('Supabase getWorkers join error, falling back:', error);

        // Fallback aggregation
        const { data: baseWorkers } = await client.from('workers').select('*').order('created_at', { ascending: false });
        const { data: allAssignments } = await client.from('order_assignments').select('*');
        if (baseWorkers) {
          return baseWorkers.map((w: any) => {
            const wAssignments = (allAssignments || []).filter((a: any) => a.worker_id === w.id);
            const activeCount = wAssignments.filter((a: any) => ['CLAIMED', 'PROCESSING', 'OUT_FOR_DELIVERY'].includes(a.status)).length;
            const completedCount = wAssignments.filter((a: any) => a.status === 'DELIVERED').length;
            return {
              ...w,
              active_orders: activeCount,
              total_completed_orders: completedCount
            };
          });
        }
      } catch (err) {
        console.error('Supabase getWorkers error:', err);
      }
      return [];
    }

    const orders = Array.from(mockStore.orders.values());
    const workers = Array.from(mockStore.workers.values());
    return workers.map(w => {
      const workerOrders = orders.filter(o => 
        o.current_worker?.id === w.id || 
        o.current_worker?.telegram_user_id === w.telegram_user_id ||
        o.assignments?.some(a => a.worker_id === w.id || a.worker?.telegram_user_id === w.telegram_user_id)
      );
      const activeCount = workerOrders.filter(o => ['CLAIMED', 'PROCESSING', 'OUT_FOR_DELIVERY'].includes(o.status)).length;
      const completedCount = workerOrders.filter(o => o.status === 'DELIVERED').length;
      return {
        ...w,
        active_orders: activeCount,
        total_completed_orders: completedCount
      };
    });
  },

  // CONVERSATIONS & CHAT
  getSessionState(conversationId: string): ConversationSessionState {
    const defaultState: ConversationSessionState = {
      step: 'IDLE',
      draftOrder: { items: [] },
      lastInteractionTimestamp: Date.now()
    };

    const existing = mockStore.sessionStates.get(conversationId);
    if (!existing) {
      mockStore.sessionStates.set(conversationId, defaultState);
      return defaultState;
    }

    // TTL check: 30 minutes of inactivity resets draft
    const thirtyMinutes = 30 * 60 * 1000;
    if (Date.now() - existing.lastInteractionTimestamp > thirtyMinutes) {
      mockStore.sessionStates.set(conversationId, defaultState);
      return defaultState;
    }

    return existing;
  },

  setSessionState(conversationId: string, stateUpdate: Partial<ConversationSessionState>): ConversationSessionState {
    const current = this.getSessionState(conversationId);
    const updated: ConversationSessionState = {
      ...current,
      ...stateUpdate,
      draftOrder: {
        ...current.draftOrder,
        ...(stateUpdate.draftOrder || {})
      },
      lastInteractionTimestamp: Date.now()
    };
    mockStore.sessionStates.set(conversationId, updated);
    return updated;
  },

  clearSessionDraft(conversationId: string, lastOrderId?: string): ConversationSessionState {
    const updated: ConversationSessionState = {
      step: lastOrderId ? 'ORDER_PLACED' : 'IDLE',
      draftOrder: { items: [] },
      lastOrderId: lastOrderId || undefined,
      lastInteractionTimestamp: Date.now()
    };
    mockStore.sessionStates.set(conversationId, updated);
    return updated;
  },

  async getConversations(): Promise<Conversation[]> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { data, error } = await client
        .from('conversations')
        .select('*, user:users(*), messages(*)')
        .order('last_message_at', { ascending: false });
      if (!error && data) {
        return data.map((c: any) => ({
          ...c,
          session_state: this.getSessionState(c.id),
          messages: Array.isArray(c.messages)
            ? c.messages.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            : []
        }));
      }
      if (error) console.error('Supabase getConversations error:', error);
      return [];
    }
    return Array.from(mockStore.conversations.values()).map(c => ({
      ...c,
      session_state: this.getSessionState(c.id),
      messages: Array.from(mockStore.messages.values())
        .filter(m => m.conversation_id === c.id)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    }));
  },

  async getOrCreateConversation(userId: string): Promise<Conversation> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { data } = await client
        .from('conversations')
        .select('*, user:users(*), messages(*)')
        .eq('user_id', userId)
        .single();
      if (data) {
        return {
          ...data,
          session_state: this.getSessionState(data.id),
          messages: Array.isArray(data.messages)
            ? data.messages.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            : []
        };
      }

      const newConv: Conversation = {
        id: crypto.randomUUID(),
        user_id: userId,
        channel: 'WHATSAPP',
        is_ai_active: true,
        last_message_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      };
      await client.from('conversations').insert(newConv);
      newConv.session_state = this.getSessionState(newConv.id);
      return newConv;
    }

    for (const c of mockStore.conversations.values()) {
      if (c.user_id === userId) {
        return {
          ...c,
          session_state: this.getSessionState(c.id),
          messages: Array.from(mockStore.messages.values())
            .filter(m => m.conversation_id === c.id)
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        };
      }
    }

    const newConv: Conversation = {
      id: `conv-${Date.now()}`,
      user_id: userId,
      channel: 'WHATSAPP',
      is_ai_active: true,
      last_message_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      user: mockStore.users.get(userId),
      session_state: this.getSessionState(`conv-${Date.now()}`)
    };
    mockStore.conversations.set(newConv.id, newConv);
    return newConv;
  },

  async addMessage(conversationId: string, sender: 'CUSTOMER' | 'BOT' | 'ADMIN', content: string): Promise<Message> {
    const msgId = crypto.randomUUID();
    const now = new Date().toISOString();

    const msg: Message = {
      id: msgId,
      conversation_id: conversationId,
      sender,
      content,
      created_at: now
    };

    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      await client.from('messages').insert({
        id: msg.id,
        conversation_id: msg.conversation_id,
        sender: msg.sender,
        content: msg.content
      });
      await client.from('conversations').update({ last_message_at: now }).eq('id', conversationId);
    } else {
      const conv = mockStore.conversations.get(conversationId);
      if (conv) conv.last_message_at = now;
      mockStore.messages.set(msg.id, msg);
    }

    return msg;
  },

  async setAiMode(conversationId: string, isAiActive: boolean): Promise<boolean> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      await client.from('conversations').update({ is_ai_active: isAiActive }).eq('id', conversationId);
      return true;
    }
    const conv = mockStore.conversations.get(conversationId);
    if (conv) {
      conv.is_ai_active = isAiActive;
      return true;
    }
    return false;
  },

  // ANALYTICS
  async getDashboardAnalytics() {
    const orders = await this.getOrders();
    const workers = await this.getWorkers();
    const users = await this.getAllUsers();

    const totalRevenue = orders
      .filter(o => o.status !== 'CANCELLED')
      .reduce((sum, o) => sum + Number(o.total_amount), 0);

    const pendingClaimCount = orders.filter(o => o.status === 'PENDING_CLAIM').length;
    const activeProcessingCount = orders.filter(o => ['CLAIMED', 'PROCESSING', 'OUT_FOR_DELIVERY'].includes(o.status)).length;
    const completedCount = orders.filter(o => o.status === 'DELIVERED').length;

    return {
      totalRevenue,
      totalOrders: orders.length,
      pendingClaimCount,
      activeProcessingCount,
      completedCount,
      totalCustomers: users.length,
      activeWorkers: workers.filter(w => w.is_active).length,
      recentOrders: orders.slice(0, 5)
    };
  }
};
