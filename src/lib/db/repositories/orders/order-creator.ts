import { Order, OrderStatus } from '@/types';
import { connectToDatabase, isDbConfigured } from '../../client';
import { OrderModel } from '../../models/Order';
import { mockStore } from '../../mock-store';
import { usersRepository } from '../users';
import { getAccountFieldInfo } from '../../../chat/input-parser';
import { hydrateOrder } from './order-hydrator';

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
      console.error('[MongoDB createOrder error]:', orderErr);
      throw new Error(`Failed to create order in MongoDB: ${orderErr.message}`);
    }
  }

  // In-memory fallback
  const newOrder: Order = {
    ...orderPayload,
    items: embeddedItems
  };

  mockStore.orders.set(orderUuid, newOrder);
  mockStore.orders.set(orderIdCode, newOrder);
  return hydrateOrder(newOrder);
}
