import { Order } from '@/types';
import { connectToDatabase, isDbConfigured } from '../../client';
import { OrderModel } from '../../models/Order';
import { mockStore } from '../../mock-store';
import { hydrateOrder } from './order-hydrator';
import { getOrderByCode } from './order-query';

/**
 * ZiniPay Integration: Find order by ZiniPay invoice_id
 */
export async function getOrderByInvoiceId(invoiceId: string): Promise<Order | null> {
  const clean = (invoiceId || '').trim();
  if (!clean) return null;

  if (isDbConfigured()) {
    try {
      await connectToDatabase();
      const doc = await OrderModel.findOne({
        $or: [
          { invoice_id: clean },
          { 'delivery_address.invoice_id': clean },
          { 'payments.invoice_id': clean }
        ]
      }).lean();

      if (doc) {
        return hydrateOrder(doc);
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
}

/**
 * ZiniPay Integration: Attach invoice ID and payment URL to an existing order
 */
export async function attachInvoiceToOrder(
  orderIdCode: string,
  invoiceId: string,
  paymentUrl: string
): Promise<{ success: boolean; order?: Order }> {
  const order = await getOrderByCode(orderIdCode);
  if (!order) return { success: false };

  const updatedAt = new Date().toISOString();

  if (isDbConfigured()) {
    try {
      await connectToDatabase();
      const updatedDelivery = {
        ...(order.delivery_address || {}),
        invoice_id: invoiceId,
        payment_url: paymentUrl
      };

      await OrderModel.updateOne(
        { $or: [{ order_id: orderIdCode }, { id: order.id }] },
        {
          $set: {
            invoice_id: invoiceId,
            payment_url: paymentUrl,
            delivery_address: updatedDelivery,
            updated_at: updatedAt
          }
        }
      );
    } catch (err) {
      console.warn('[attachInvoiceToOrder MongoDB warn]:', err);
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
}

/**
 * ZiniPay Integration: Mark order and payment as verified upon successful payment
 */
export async function updateOrderPaymentSuccess(
  orderIdCode: string,
  details: {
    trxId: string;
    paymentMethod: string;
    invoiceId?: string;
    amount?: number;
  }
): Promise<{ success: boolean; order?: Order }> {
  const order = await getOrderByCode(orderIdCode);
  if (!order) return { success: false };

  const verifiedAt = new Date().toISOString();

  if (isDbConfigured()) {
    try {
      await connectToDatabase();
      const updatedDelivery = {
        ...(order.delivery_address || {}),
        trx_id: details.trxId,
        payment_method: details.paymentMethod,
        ...(details.invoiceId ? { invoice_id: details.invoiceId } : {})
      };

      const newPayment = {
        id: crypto.randomUUID(),
        amount: details.amount || order.total_amount,
        method: details.paymentMethod,
        status: 'VERIFIED',
        transaction_id: details.trxId,
        invoice_id: details.invoiceId || null,
        created_at: verifiedAt
      };

      await OrderModel.updateOne(
        { $or: [{ order_id: orderIdCode }, { id: order.id }] },
        {
          $set: {
            trx_id: details.trxId,
            payment_method: details.paymentMethod,
            ...(details.invoiceId ? { invoice_id: details.invoiceId } : {}),
            delivery_address: updatedDelivery,
            updated_at: verifiedAt
          },
          $push: {
            payments: newPayment
          }
        }
      );
    } catch (err) {
      console.error('[updateOrderPaymentSuccess MongoDB error]:', err);
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
