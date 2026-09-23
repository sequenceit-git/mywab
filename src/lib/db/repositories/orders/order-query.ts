import { Order, OrderStatus } from '@/types';
import { getDbClient, isSupabaseConfigured } from '../../client';
import { mockStore } from '../../mock-store';
import { hydrateOrder } from './order-hydrator';

export async function getOrders(filter?: { status?: OrderStatus; limit?: number }): Promise<Order[]> {
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
}

export async function getOrderByCode(orderIdCode: string): Promise<Order | null> {
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
        query = query.eq('id', clean);
      } else {
        query = query.eq('order_id', clean);
      }

      const { data, error } = await query.maybeSingle();
      if (!error && data) {
        return hydrateOrder(data);
      }
      if (error) console.error('Supabase getOrderByCode error:', error);
    } catch (err) {
      console.error('Supabase getOrderByCode exception:', err);
    }
  }

  const order = mockStore.orders.get(clean) ||
    Array.from(mockStore.orders.values()).find(
      o => o.order_id.toUpperCase() === clean.toUpperCase() || o.id === clean
    );
  return order ? hydrateOrder(order) : null;
}

export async function getOrderById(id: string): Promise<Order | null> {
  return getOrderByCode(id);
}

export async function getOrdersByPhone(phone: string): Promise<Order[]> {
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
}
