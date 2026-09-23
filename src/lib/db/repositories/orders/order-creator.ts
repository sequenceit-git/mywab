import { Order, OrderStatus } from '@/types';
import { getDbClient, isSupabaseConfigured } from '../../client';
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
}
