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
 * ZiniPay Integration: Mark order and payment as verified upon successful payment.
 * Uses an atomic findOneAndUpdate so only the FIRST concurrent call wins —
 * any subsequent duplicate webhook / success-page call sees trx_id already set
 * and returns { success: false, alreadyProcessed: true } without side-effects.
 */
export async function updateOrderPaymentSuccess(
  orderIdCode: string,
  details: {
    trxId: string;
    paymentMethod: string;
    invoiceId?: string;
    amount?: number;
  }
): Promise<{ success: boolean; alreadyProcessed?: boolean; order?: Order }> {
  const order = await getOrderByCode(orderIdCode);
  if (!order) return { success: false };

  // Guard: if trx_id already set this payment was already claimed — skip entirely.
  if (order.trx_id) {
    console.log(`[updateOrderPaymentSuccess] Order ${orderIdCode} already has trx_id=${order.trx_id}. Skipping duplicate.`);
    return { success: true, alreadyProcessed: true, order };
  }

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

      // Atomic: only update if trx_id is still unset (race-condition safe mutex)
      const result = await OrderModel.findOneAndUpdate(
        {
          $and: [
            { $or: [{ order_id: orderIdCode }, { id: order.id }] },
            { $or: [{ trx_id: null }, { trx_id: { $exists: false } }] }
          ]
        },
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
        },
        { new: true }
      );

      // If nothing was updated, another process already claimed this payment
      if (!result) {
        console.log(`[updateOrderPaymentSuccess] Atomic update found order ${orderIdCode} already processed. Skipping.`);
        return { success: true, alreadyProcessed: true, order };
      }
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
