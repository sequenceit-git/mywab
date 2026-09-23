import { Order, OrderStatus } from '@/types';
import { connectToDatabase, isDbConfigured } from '../../client';
import { OrderModel } from '../../models/Order';
import { mockStore } from '../../mock-store';
import { hydrateOrder } from './order-hydrator';

export async function getOrders(filter?: { status?: OrderStatus; limit?: number }): Promise<Order[]> {
  if (isDbConfigured()) {
    try {
      await connectToDatabase();
      const mongoFilter: any = {};
      if (filter?.status) {
        mongoFilter.status = filter.status;
      }

      let q = OrderModel.find(mongoFilter).sort({ created_at: -1 });
      if (filter?.limit) {
        q = q.limit(filter.limit);
      }

      const docs = await q.lean();
      if (docs && docs.length > 0) {
        return docs.map((doc: any) => hydrateOrder(doc));
      }
    } catch (err) {
      console.error('[MongoDB getOrders exception]:', err);
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

  if (isDbConfigured()) {
    try {
      await connectToDatabase();
      const doc = await OrderModel.findOne({
        $or: [
          { order_id: { $regex: new RegExp(`^${clean}$`, 'i') } },
          { id: clean }
        ]
      }).lean();

      if (doc) {
        return hydrateOrder(doc);
      }
    } catch (err) {
      console.error('[MongoDB getOrderByCode exception]:', err);
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

  if (isDbConfigured()) {
    try {
      await connectToDatabase();
      const docs = await OrderModel.find({
        $or: [
          { delivery_phone: cleanPhone },
          { delivery_phone: cleanPhone.replace(/^\+/, '') },
          { delivery_phone: `+${cleanPhone.replace(/^\+/, '')}` }
        ]
      })
      .sort({ created_at: -1 })
      .lean();

      if (docs && docs.length > 0) {
        return docs.map((doc: any) => hydrateOrder(doc));
      }
    } catch (err) {
      console.error('[MongoDB getOrdersByPhone exception]:', err);
    }
  }

  return Array.from(mockStore.orders.values())
    .filter(o => o.delivery_phone === cleanPhone)
    .map(o => hydrateOrder(o))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
