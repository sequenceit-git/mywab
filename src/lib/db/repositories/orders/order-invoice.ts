import { Order } from '@/types';
import { getDbClient, isSupabaseConfigured } from '../../client';
import { mockStore } from '../../mock-store';
import { hydrateOrder } from './order-hydrator';
import { getOrderByCode } from './order-query';

/**
 * ZiniPay Integration: Find order by ZiniPay invoice_id
 */
export async function getOrderByInvoiceId(invoiceId: string): Promise<Order | null> {
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
