import { Order } from '@/types';
import { getDbClient, isSupabaseConfigured } from '../../client';
import { mockStore } from '../../mock-store';
import { hydrateOrder } from './order-hydrator';

/**
 * Telegram Queue Helpers: Next pending order waiting in line for dispatch
 */
export async function getNextQueuedOrder(): Promise<Order | null> {
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
}

/**
 * Telegram Queue Helpers: Count of pending orders waiting in the queue
 */
export async function getUndispatchedQueueCount(): Promise<number> {
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
}

/**
 * Telegram Queue Helpers: Find if there is an active unclaimed order card in Telegram
 */
export async function getActiveTelegramUnclaimedOrder(): Promise<Order | null> {
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
}
