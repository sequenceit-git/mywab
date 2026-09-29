import { Order, OrderStatus } from '@/types';
import { connectToDatabase, isDbConfigured } from '../../client';
import { OrderModel } from '../../models/Order';
import { mockStore } from '../../mock-store';
import { usersRepository } from '../users';
import { getAccountFieldInfo } from '../../../chat/input-parser';
import { hydrateOrder } from './order-hydrator';

function dhakaDateStamp(d = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(d);
  const y = parts.find(p => p.type === 'year')?.value || '0000';
  const m = parts.find(p => p.type === 'month')?.value || '00';
  const day = parts.find(p => p.type === 'day')?.value || '00';
  return `${y}${m}${day}`;
}

async function nextSequentialOrderId(): Promise<string> {
  const prefix = `WAP-${dhakaDateStamp()}-`;
  let next = 1;

  if (isDbConfigured()) {
    await connectToDatabase();
    const docs = await OrderModel.find({ order_id: { $regex: `^${prefix}\\d+$` } })
      .select({ order_id: 1, _id: 0 })
      .lean();
    for (const doc of docs) {
      const n = parseInt(String(doc.order_id).slice(prefix.length), 10);
      if (Number.isFinite(n) && n >= next) next = n + 1;
    }
  } else {
    const seen = new Set<string>();
    for (const order of mockStore.orders.values()) {
      if (!order.order_id || seen.has(order.order_id)) continue;
      seen.add(order.order_id);
      if (!order.order_id.startsWith(prefix)) continue;
      const n = parseInt(order.order_id.slice(prefix.length), 10);
      if (Number.isFinite(n) && n >= next) next = n + 1;
    }
  }

  return `${prefix}${next}`;
}

export async function createOrder(params: {
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

  const embeddedItems = params.items.map(item => ({
    id: crypto.randomUUID(),
    product_id: item.product_id || null,
    product_name: item.product_name,
    unit_price: item.unit_price,
    quantity: item.quantity,
    subtotal: item.unit_price * item.quantity,
  }));

  const embeddedPayments: any[] = [];
  if (params.trxId || params.invoiceId) {
    embeddedPayments.push({
      id: crypto.randomUUID(),
      amount: totalAmount,
      method: params.paymentMethod || (params.invoiceId ? 'ZINIPAY' : 'BKASH'),
      status: params.trxId ? 'VERIFYING' : 'UNPAID',
      transaction_id: params.trxId || null,
      invoice_id: params.invoiceId || null,
      created_at: new Date().toISOString()
    });
  }

  const MAX_ID_ATTEMPTS = 8;
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt++) {
    const orderIdCode = await nextSequentialOrderId();
    const orderPayload: any = {
      id: orderUuid,
      order_id: orderIdCode,
      user_id: params.userId,
      total_amount: totalAmount,
      status: orderStatus,
      delivery_address: deliveryAddressObj,
      delivery_phone: params.deliveryPhone,
      customer_notes: params.customerNotes || (params.playerUid ? `${accountLabel}: ${params.playerUid} | Trx: ${params.trxId || 'N/A'} | Pay: ${params.paymentMethod || 'BKASH'}` : null),
      player_uid: params.playerUid || null,
      trx_id: params.trxId || null,
      payment_method: params.paymentMethod || (params.invoiceId ? 'ZINIPAY' : 'BKASH'),
      invoice_id: params.invoiceId || null,
      payment_url: params.paymentUrl || null,
      items: embeddedItems,
      payments: embeddedPayments,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (isDbConfigured()) {
      try {
        await connectToDatabase();
        const createdDoc = await OrderModel.create(orderPayload);
        const user = await usersRepository.getUserById(params.userId);
        return hydrateOrder({
          ...createdDoc.toObject(),
          customer: user || undefined,
        });
      } catch (orderErr: any) {
        lastError = orderErr;
        if (orderErr?.code === 11000) {
          continue;
        }
        console.error('[MongoDB createOrder error]:', orderErr);
        throw new Error(`Failed to create order in MongoDB: ${orderErr.message}`);
      }
    }

    const newOrder: Order = {
      ...orderPayload,
      items: embeddedItems
    };

    mockStore.orders.set(orderUuid, newOrder);
    mockStore.orders.set(orderIdCode, newOrder);
    return hydrateOrder(newOrder);
  }

  console.error('[MongoDB createOrder error]:', lastError);
  throw new Error('Failed to allocate a unique sequential order ID');
}
