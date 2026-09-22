import { Order, OrderStatus } from '@/types';
import { getDbClient, isSupabaseConfigured } from '../client';
import { mockStore } from '../mock-store';
import { usersRepository } from './users';
import { getAccountFieldInfo } from '../../chat/input-parser';

export function hydrateOrder(data: any): Order {
  if (!data) return data;

  // Extract player_uid with multi-layer fallback
  let playerUid = data.player_uid;
  if (!playerUid && data.delivery_address && typeof data.delivery_address === 'object') {
    playerUid = data.delivery_address.player_uid || data.delivery_address.name;
    if (!playerUid && typeof data.delivery_address.address === 'string') {
      const match = data.delivery_address.address.match(/(?:UID|Player UID|Email|Gmail|Account|ID|Phone):\s*([0-9a-zA-Z@._+-]+)/i);
      if (match) playerUid = match[1];
    }
  }
  if (!playerUid && typeof data.customer_notes === 'string') {
    const match = data.customer_notes.match(/(?:PUBG UID|Free Fire UID|UID|Player UID|Email|Gmail|Account|ID):\s*([0-9a-zA-Z@._+-]+)/i);
    if (match) playerUid = match[1];
  }

  // Extract trx_id with multi-layer fallback
  let trxId = data.trx_id;
  if (!trxId && data.delivery_address && typeof data.delivery_address === 'object') {
    trxId = data.delivery_address.trx_id || data.delivery_address.notes;
  }
  if (!trxId && typeof data.customer_notes === 'string') {
    const match = data.customer_notes.match(/Trx:\s*([^|\n]+)/i);
    if (match) trxId = match[1].trim();
  }
  if (!trxId && Array.isArray(data.payments) && data.payments.length > 0) {
    trxId = data.payments[0].transaction_id || data.payments[0].trx_id;
  }

  // Extract payment_method with multi-layer fallback
  let paymentMethod = data.payment_method;
  if (!paymentMethod && data.delivery_address && typeof data.delivery_address === 'object') {
    paymentMethod = data.delivery_address.payment_method;
  }
  if (!paymentMethod && typeof data.customer_notes === 'string') {
    const match = data.customer_notes.match(/Pay:\s*([^|\n]+)/i);
    if (match) paymentMethod = match[1].trim();
  }
  if (!paymentMethod && Array.isArray(data.payments) && data.payments.length > 0) {
    paymentMethod = data.payments[0].payment_method || data.payments[0].method;
  }

  // Extract invoice_id and payment_url for ZiniPay integration
  let invoiceId = data.invoice_id;
  if (!invoiceId && data.delivery_address && typeof data.delivery_address === 'object') {
    invoiceId = data.delivery_address.invoice_id;
  }
  if (!invoiceId && Array.isArray(data.payments) && data.payments.length > 0) {
    invoiceId = data.payments[0].invoice_id;
  }

  let paymentUrl = data.payment_url;
  if (!paymentUrl && data.delivery_address && typeof data.delivery_address === 'object') {
    paymentUrl = data.delivery_address.payment_url;
  }

  const assignments = Array.isArray(data.assignments) ? data.assignments : [];
  const assignedWorker = 
    data.current_worker || 
    assignments.find((a: any) => ['CLAIMED', 'PROCESSING', 'OUT_FOR_DELIVERY', 'IN_PROGRESS', 'DELIVERED'].includes(a.status))?.worker ||
    assignments[0]?.worker ||
    null;

  return {
    ...data,
    player_uid: playerUid || undefined,
    trx_id: trxId || undefined,
    payment_method: paymentMethod || 'bKash/Nagad/Rocket',
    invoice_id: invoiceId || undefined,
    payment_url: paymentUrl || undefined,
    current_worker: assignedWorker
  };
}

export const ordersRepository = {
  hydrateOrder,

  async createOrder(params: {
    userId: string;
    items: Array<{
      product_id?: string;
      product_name: string;
      unit_price: number;
      quantity: number;
    }>;
    deliveryAddress?: {
      name?: string;
      phone?: string;
      address: string;
      city?: string;
      area?: string;
      notes?: string;
      player_uid?: string;
      trx_id?: string;
      payment_method?: string;
    };
    deliveryPhone: string;
    customerNotes?: string;
    playerUid?: string;
    trxId?: string;
    paymentMethod?: string;
    status?: OrderStatus;
    invoiceId?: string;
    paymentUrl?: string;
  }): Promise<Order> {
    const totalAmount = params.items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderIdCode = `WAP-${dateStr}-${randomSuffix}`;
    const orderUuid = crypto.randomUUID();
    const orderStatus: OrderStatus = params.status || (params.invoiceId ? 'PENDING_PAYMENT' : 'PENDING_CLAIM');

    const productName = params.items?.[0]?.product_name || '';
    const accountInfo = getAccountFieldInfo(params.playerUid || '', productName);
    const accountLabel = accountInfo.labelEn;

    const deliveryAddressObj = {
      address: `${accountLabel}: ${params.playerUid || 'N/A'}`,
      player_uid: params.playerUid || null,
      trx_id: params.trxId || null,
      payment_method: params.paymentMethod || 'BKASH',
      invoice_id: params.invoiceId || null,
      payment_url: params.paymentUrl || null,
      name: params.playerUid || null,
      phone: params.deliveryPhone,
      ...(params.deliveryAddress || {})
    };

    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      // 1. Insert order record
      const orderPayload: Record<string, any> = {
        id: orderUuid,
        order_id: orderIdCode,
        user_id: params.userId,
        total_amount: totalAmount,
        status: orderStatus,
        delivery_address: deliveryAddressObj,
        delivery_phone: params.deliveryPhone,
        customer_notes: params.customerNotes || (params.playerUid ? `${accountLabel}: ${params.playerUid} | Trx: ${params.trxId || 'N/A'} | Pay: ${params.paymentMethod || 'BKASH'}` : null),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (params.invoiceId) {
        orderPayload.invoice_id = params.invoiceId;
      }
      if (params.paymentUrl) {
        orderPayload.payment_url = params.paymentUrl;
      }

      const { data: createdOrder, error: orderErr } = await client
        .from('orders')
        .insert(orderPayload)
        .select()
        .single();

      if (orderErr) {
        console.error('Supabase createOrder error:', orderErr);
        throw new Error(`Failed to create order in Supabase: ${orderErr.message}`);
      }

      // 2. Insert order items
      if (params.items.length > 0) {
        const orderItems = params.items.map(item => ({
          id: crypto.randomUUID(),
          order_id: orderUuid,
          product_id: item.product_id || null,
          product_name: item.product_name,
          unit_price: item.unit_price,
          quantity: item.quantity,
          subtotal: item.unit_price * item.quantity,
          created_at: new Date().toISOString()
        }));

        await client.from('order_items').insert(orderItems);
      }

      // 3. Insert payment record
      if (params.trxId || params.invoiceId) {
        try {
          const payPayload: Record<string, any> = {
            id: crypto.randomUUID(),
            order_id: orderUuid,
            payment_method: params.paymentMethod || (params.invoiceId ? 'ZINIPAY' : 'BKASH'),
            trx_id: params.trxId || null,
            amount: totalAmount,
            status: params.trxId ? 'VERIFYING' : 'UNPAID',
            created_at: new Date().toISOString()
          };
          if (params.invoiceId) {
            payPayload.invoice_id = params.invoiceId;
          }
          await client.from('payments').insert(payPayload);
        } catch (payErr) {
          console.warn('Payment record insert non-fatal error:', payErr);
        }
      }

      // 4. Return fully hydrated order with user profile
      const user = await usersRepository.getUserById(params.userId);
      return hydrateOrder({
        ...createdOrder,
        customer: user || undefined,
        items: params.items.map(i => ({
          ...i,
          subtotal: i.unit_price * i.quantity
        }))
      });
    }

    // In-memory fallback
    const newOrder: Order = {
      id: orderUuid,
      order_id: orderIdCode,
      user_id: params.userId,
      total_amount: totalAmount,
      status: orderStatus,
      delivery_address: params.deliveryAddress || {
        address: `${accountLabel}: ${params.playerUid || 'N/A'}`
      },
      delivery_phone: params.deliveryPhone,
      customer_notes: params.customerNotes || (params.playerUid ? `${accountLabel}: ${params.playerUid} | Trx: ${params.trxId || 'N/A'} | Pay: ${params.paymentMethod || 'BKASH'}` : undefined),
      player_uid: params.playerUid,
      trx_id: params.trxId,
      payment_method: params.paymentMethod || (params.invoiceId ? 'ZINIPAY' : 'BKASH'),
      invoice_id: params.invoiceId,
      payment_url: params.paymentUrl,
      created_at: new Date().toISOString(),
      items: params.items.map(i => ({
        ...i,
        subtotal: i.unit_price * i.quantity
      }))
    };

    mockStore.orders.set(orderIdCode, newOrder);
    return newOrder;
  },

  async getOrders(filter?: { status?: OrderStatus; limit?: number }): Promise<Order[]> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      try {
        let query = client
          .from('orders')
          .select(`
            *,
            customer:users(*),
            items:order_items(*),
            payments:payments(*),
            assignments:order_assignments(
              id,
              status,
              claimed_at,
              worker:workers(*)
            )
          `)
          .order('created_at', { ascending: false });

        if (filter?.status) {
          query = query.eq('status', filter.status);
        }
        if (filter?.limit) {
          query = query.limit(filter.limit);
        }

        const { data, error } = await query;
        if (!error && data) {
          return data.map((order: any) => hydrateOrder(order));
        }
        if (error) console.error('Supabase getOrders error:', error);
      } catch (err) {
        console.error('Supabase getOrders exception:', err);
      }
    }

    let all = Array.from(mockStore.orders.values()).map(o => hydrateOrder(o));
    if (filter?.status) {
      all = all.filter(o => o.status === filter.status);
    }
    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (filter?.limit) {
      all = all.slice(0, filter.limit);
    }
    return all;
  },

  async getOrderByCode(orderIdCode: string): Promise<Order | null> {
    const clean = orderIdCode.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
    const client = getDbClient();

    if (isSupabaseConfigured() && client) {
      try {
        let query = client
          .from('orders')
          .select(`
            *,
            customer:users(*),
            items:order_items(*),
            payments:payments(*),
            assignments:order_assignments(
              id,
              status,
              claimed_at,
              worker:workers(*)
            )
          `);

        if (isUuid) {
          query = query.or(`order_id.eq.${clean.toUpperCase()},id.eq.${clean}`);
        } else {
          query = query.eq('order_id', clean.toUpperCase());
        }

        const { data, error } = await query.maybeSingle();

        if (!error && data) {
          return hydrateOrder(data);
        }
        if (error) {
          console.error('Supabase getOrderByCode error:', error);
        }
      } catch (err) {
        console.error('Supabase getOrderByCode exception:', err);
      }
    }

    const cleanUpper = clean.toUpperCase();
    for (const o of mockStore.orders.values()) {
      if (o.order_id.toUpperCase() === cleanUpper || o.id === clean) {
        return hydrateOrder(o);
      }
    }
    return null;
  },

  async getOrderById(id: string): Promise<Order | null> {
    return this.getOrderByCode(id);
  },

  async getOrdersByPhone(phone: string): Promise<Order[]> {
    const cleanPhone = phone.trim();
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { data, error } = await client
        .from('orders')
        .select(`
          *,
          customer:users(*),
          items:order_items(*),
          payments:payments(*),
          assignments:order_assignments(
            id,
            status,
            claimed_at,
            worker:workers(*)
          )
        `)
        .eq('delivery_phone', cleanPhone)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data.map((order: any) => hydrateOrder(order));
      }
    }

    return Array.from(mockStore.orders.values())
      .filter(o => o.delivery_phone === cleanPhone)
      .map(o => hydrateOrder(o))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async updateOrderStatus(
    orderIdCode: string,
    status: OrderStatus,
    options?: {
      telegramUserId?: number;
      workerTelegramId?: number;
      isAdminOverride?: boolean;
      notes?: string;
      customerNotes?: string;
    }
  ): Promise<{ success: boolean; message: string; order?: Order }> {
    const order = await this.getOrderByCode(orderIdCode);
    if (!order) {
      return { success: false, message: 'অর্ডারটি খুঁজে পাওয়া যায়নি।' };
    }

    const { isAdminOverride = false, notes, customerNotes } = options || {};
    const telegramUserId = options?.telegramUserId ?? options?.workerTelegramId;
    const finalNotes = notes || customerNotes;

    // 1. Worker Lock Check: If not an admin override, verify that this worker owns the order
    if (!isAdminOverride && telegramUserId) {
      const isAssignedToThisWorker = order.current_worker?.telegram_user_id === telegramUserId;
      if (order.current_worker && !isAssignedToThisWorker) {
        const assignedName = order.current_worker.full_name || 'অন্য একজন কর্মী';
        return {
          success: false,
          message: `এই অর্ডারটি ইতোমধ্যে ${assignedName} ক্লেইম করেছেন। শুধুমাত্র তিনি অথবা অ্যাডমিন প্যানেল এটি পরিবর্তন করতে পারবেন।`
        };
      }
    }

    // 2. Admin Override Actions
    if (isAdminOverride && (status === 'PENDING_CLAIM' || status === 'PENDING_PAYMENT' || status === 'CANCELLED')) {
      if (status === 'PENDING_CLAIM' || status === 'PENDING_PAYMENT') {
        order.current_worker = undefined;
      }
    }

    order.status = status;
    if (finalNotes) {
      order.customer_notes = finalNotes;
    }
    order.updated_at = new Date().toISOString();

    for (const o of mockStore.orders.values()) {
      if (o.order_id.toUpperCase() === orderIdCode.toUpperCase() || o.id === order.id) {
        o.status = status;
        if (finalNotes) {
          o.customer_notes = finalNotes;
        }
        o.updated_at = new Date().toISOString();
        if (status === 'PENDING_CLAIM' || status === 'PENDING_PAYMENT') {
          o.current_worker = undefined;
        }
        break;
      }
    }

    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const updatePayload: Record<string, any> = {
        status,
        updated_at: new Date().toISOString()
      };
      if (finalNotes) {
        updatePayload.customer_notes = finalNotes;
      }
      await client
        .from('orders')
        .update(updatePayload)
        .eq('order_id', orderIdCode);
      
      if (status === 'DELIVERED') {
        await client
          .from('order_assignments')
          .update({ status: 'DELIVERED', completed_at: new Date().toISOString() })
          .eq('order_id', order.id);
      } else if (status === 'CANCELLED') {
        await client
          .from('order_assignments')
          .update({ status: 'CANCELLED', completed_at: new Date().toISOString() })
          .eq('order_id', order.id);
      }
    }

    return { success: true, message: `Status updated to ${status}`, order: hydrateOrder(order) };
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

  /**
   * Telegram Queue Helpers: Fetch the next oldest pending order in line
   */
  async getNextQueuedOrder(): Promise<Order | null> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      try {
        const { data, error } = await client
          .from('orders')
          .select(`
            *,
            customer:users(*),
            items:order_items(*),
            payments:payments(*),
            assignments:order_assignments(
              id,
              status,
              claimed_at,
              worker:workers(*)
            )
          `)
          .in('status', ['PENDING_CLAIM', 'PENDING'])
          .is('telegram_message_id', null)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          return hydrateOrder(data);
        }
      } catch (err) {
        console.error('[getNextQueuedOrder Exception]:', err);
      }
    }

    const queued = Array.from(mockStore.orders.values())
      .filter(o => ['PENDING_CLAIM', 'PENDING'].includes(o.status) && !o.telegram_message_id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return queued[0] ? hydrateOrder(queued[0]) : null;
  },

  /**
   * Telegram Queue Helpers: Count of pending orders waiting in the queue
   */
  async getUndispatchedQueueCount(): Promise<number> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      try {
        const { count, error } = await client
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .in('status', ['PENDING_CLAIM', 'PENDING'])
          .is('telegram_message_id', null);

        if (!error && typeof count === 'number') {
          return count;
        }
      } catch (err) {
        console.error('[getUndispatchedQueueCount Exception]:', err);
      }
    }

    return Array.from(mockStore.orders.values())
      .filter(o => ['PENDING_CLAIM', 'PENDING'].includes(o.status) && !o.telegram_message_id)
      .length;
  },

  /**
   * Telegram Queue Helpers: Find if there is an active unclaimed order card in Telegram
   */
  async getActiveTelegramUnclaimedOrder(): Promise<Order | null> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      try {
        const { data, error } = await client
          .from('orders')
          .select(`
            *,
            customer:users(*),
            items:order_items(*),
            payments:payments(*),
            assignments:order_assignments(
              id,
              status,
              claimed_at,
              worker:workers(*)
            )
          `)
          .in('status', ['PENDING_CLAIM', 'PENDING'])
          .not('telegram_message_id', 'is', null)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          return hydrateOrder(data);
        }
      } catch (err) {
        console.error('[getActiveTelegramUnclaimedOrder Exception]:', err);
      }
    }

    const active = Array.from(mockStore.orders.values())
      .filter(o => ['PENDING_CLAIM', 'PENDING'].includes(o.status) && Boolean(o.telegram_message_id))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return active[0] ? hydrateOrder(active[0]) : null;
  },

  /**
   * ZiniPay Integration: Find order by ZiniPay invoice_id
   */
  async getOrderByInvoiceId(invoiceId: string): Promise<Order | null> {
    const clean = (invoiceId || '').trim();
    if (!clean) return null;

    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      try {
        const { data, error } = await client
          .from('orders')
          .select(`
            *,
            customer:users(*),
            items:order_items(*),
            payments:payments(*),
            assignments:order_assignments(
              id,
              status,
              claimed_at,
              worker:workers(*)
            )
          `)
          .eq('invoice_id', clean)
          .maybeSingle();

        if (!error && data) {
          return hydrateOrder(data);
        }

        // Secondary search in delivery_address jsonb if column wasn't populated
        const { data: fallbackData } = await client
          .from('orders')
          .select(`
            *,
            customer:users(*),
            items:order_items(*),
            payments:payments(*),
            assignments:order_assignments(
              id,
              status,
              claimed_at,
              worker:workers(*)
            )
          `)
          .contains('delivery_address', { invoice_id: clean })
          .maybeSingle();

        if (fallbackData) {
          return hydrateOrder(fallbackData);
        }
      } catch (err) {
        console.error('[getOrderByInvoiceId Exception]:', err);
      }
    }

    // In-memory fallback
    for (const o of mockStore.orders.values()) {
      if (
        o.invoice_id === clean || 
        (o.delivery_address as any)?.invoice_id === clean ||
        o.payments?.some(p => p.invoice_id === clean)
      ) {
        return hydrateOrder(o);
      }
    }

    return null;
  },

  /**
   * ZiniPay Integration: Attach invoice ID and payment URL to an existing order
   */
  async attachInvoiceToOrder(
    orderIdCode: string,
    invoiceId: string,
    paymentUrl: string
  ): Promise<{ success: boolean; order?: Order }> {
    const order = await this.getOrderByCode(orderIdCode);
    if (!order) return { success: false };

    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      try {
        const updatedDelivery = {
          ...(order.delivery_address || {}),
          invoice_id: invoiceId,
          payment_url: paymentUrl
        };

        await client
          .from('orders')
          .update({
            invoice_id: invoiceId,
            payment_url: paymentUrl,
            delivery_address: updatedDelivery,
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id);

        // Also update or insert payment record
        await client
          .from('payments')
          .update({ invoice_id: invoiceId })
          .eq('order_id', order.id);
      } catch (err) {
        console.warn('[attachInvoiceToOrder Supabase warn]:', err);
      }
    }

    // Update in-memory
    order.invoice_id = invoiceId;
    order.payment_url = paymentUrl;
    if (order.delivery_address) {
      (order.delivery_address as any).invoice_id = invoiceId;
      (order.delivery_address as any).payment_url = paymentUrl;
    }
    for (const o of mockStore.orders.values()) {
      if (o.order_id.toUpperCase() === orderIdCode.toUpperCase() || o.id === order.id) {
        o.invoice_id = invoiceId;
        o.payment_url = paymentUrl;
      }
    }

    return { success: true, order: hydrateOrder(order) };
  },

  /**
   * ZiniPay Integration: Mark order and payment as verified upon successful payment
   */
  async updateOrderPaymentSuccess(
    orderIdCode: string,
    details: {
      trxId: string;
      paymentMethod: string;
      invoiceId?: string;
      amount?: number;
    }
  ): Promise<{ success: boolean; order?: Order }> {
    const order = await this.getOrderByCode(orderIdCode);
    if (!order) return { success: false };

    const client = getDbClient();
    const verifiedAt = new Date().toISOString();

    if (isSupabaseConfigured() && client) {
      try {
        const updatedDelivery = {
          ...(order.delivery_address || {}),
          trx_id: details.trxId,
          payment_method: details.paymentMethod,
          ...(details.invoiceId ? { invoice_id: details.invoiceId } : {})
        };

        await client
          .from('orders')
          .update({
            trx_id: details.trxId,
            payment_method: details.paymentMethod,
            delivery_address: updatedDelivery,
            updated_at: verifiedAt
          })
          .eq('id', order.id);

        // Update existing payment record or insert new verified payment
        const { data: existingPay } = await client
          .from('payments')
          .select('id')
          .eq('order_id', order.id)
          .maybeSingle();

        if (existingPay?.id) {
          await client
            .from('payments')
            .update({
              status: 'VERIFIED',
              trx_id: details.trxId,
              payment_method: details.paymentMethod,
              ...(details.invoiceId ? { invoice_id: details.invoiceId } : {}),
              verified_at: verifiedAt
            })
            .eq('id', existingPay.id);
        } else {
          await client.from('payments').insert({
            id: crypto.randomUUID(),
            order_id: order.id,
            payment_method: details.paymentMethod,
            trx_id: details.trxId,
            invoice_id: details.invoiceId || null,
            amount: details.amount || order.total_amount,
            status: 'VERIFIED',
            verified_at: verifiedAt,
            created_at: verifiedAt
          });
        }
      } catch (err) {
        console.error('[updateOrderPaymentSuccess Supabase error]:', err);
      }
    }

    // In-memory update
    order.trx_id = details.trxId;
    order.payment_method = details.paymentMethod;
    if (details.invoiceId) order.invoice_id = details.invoiceId;
    order.updated_at = verifiedAt;

    for (const o of mockStore.orders.values()) {
      if (o.order_id.toUpperCase() === orderIdCode.toUpperCase() || o.id === order.id) {
        o.trx_id = details.trxId;
        o.payment_method = details.paymentMethod;
        if (details.invoiceId) o.invoice_id = details.invoiceId;
        o.updated_at = verifiedAt;
      }
    }

    return { success: true, order: hydrateOrder(order) };
  }
};
