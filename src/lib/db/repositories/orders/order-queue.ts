import { Order } from '@/types';
import { connectToDatabase, isDbConfigured } from '../../client';
import { OrderModel } from '../../models/Order';
import { mockStore } from '../../mock-store';
import { hydrateOrder } from './order-hydrator';

/**
 * Telegram Queue Helpers: Next pending order waiting in line for dispatch
 */
export async function getNextQueuedOrder(): Promise<Order | null> {
  if (isDbConfigured()) {
    try {
      await connectToDatabase();
      const doc = await OrderModel.findOne({
        status: { $in: ['PENDING_CLAIM', 'PENDING'] },
        telegram_message_id: null
      })
      .sort({ created_at: 1 })
      .lean();

      if (doc) {
        return hydrateOrder(doc);
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
  if (isDbConfigured()) {
    try {
      await connectToDatabase();
      const count = await OrderModel.countDocuments({
        status: { $in: ['PENDING_CLAIM', 'PENDING'] },
        telegram_message_id: null
      });
      return count;
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
  if (isDbConfigured()) {
    try {
      await connectToDatabase();
      const doc = await OrderModel.findOne({
        status: { $in: ['PENDING_CLAIM', 'PENDING'] },
        telegram_message_id: { $ne: null }
      })
      .sort({ created_at: 1 })
      .lean();

      if (doc) {
        return hydrateOrder(doc);
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
