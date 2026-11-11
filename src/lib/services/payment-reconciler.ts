import { connectToDatabase, isDbConfigured } from '../db/client';
import { OrderModel } from '../db/models/Order';
import { hydrateOrder } from '../db/repositories/orders/order-hydrator';
import { zinipayClient } from '../zinipay/client';
import { orderPaymentService } from './order-payment';

// Give the ZiniPay webhook a head start before we poll on its behalf.
const MIN_AGE_MS = 2 * 60 * 1000;
// Invoices older than this are treated as abandoned.
const MAX_AGE_MS = 48 * 60 * 60 * 1000;
const BATCH_LIMIT = 50;

let running = false;

/**
 * Safety net for missed/failed ZiniPay webhooks: re-verify recent PENDING_PAYMENT
 * orders with ZiniPay and fulfill any that are actually paid.
 * handlePaymentVerified is idempotent, so overlapping with the webhook is safe.
 */
export async function reconcilePendingPayments(): Promise<{ checked: number; fulfilled: string[] }> {
  const result = { checked: 0, fulfilled: [] as string[] };
  if (running || !isDbConfigured() || !zinipayClient.isConfigured()) return result;
  running = true;

  try {
    await connectToDatabase();
    const now = Date.now();
    const docs = await OrderModel.find({
      status: 'PENDING_PAYMENT',
      created_at: {
        $gte: new Date(now - MAX_AGE_MS).toISOString(),
        $lte: new Date(now - MIN_AGE_MS).toISOString()
      }
    })
      .sort({ created_at: 1 })
      .limit(BATCH_LIMIT)
      .lean();

    for (const doc of docs) {
      const order = hydrateOrder(doc);
      const invoiceId = order.invoice_id || zinipayClient.extractInvoiceId(order.payment_url || undefined);
      if (!invoiceId) continue;

      result.checked++;
      try {
        const verify = await zinipayClient.verifyInvoice(invoiceId);
        if (verify.status !== 'COMPLETED') continue;

        console.log(`[PaymentReconciler] Order #${order.order_id} is paid (invoice ${invoiceId}) but still PENDING_PAYMENT — fulfilling.`);
        const res = await orderPaymentService.handlePaymentVerified({
          orderIdCode: order.order_id,
          invoiceId,
          trxId: verify.transaction_id || `ZINI-${Date.now()}`,
          paymentMethod: verify.payment_method || 'bKash',
          amount: Number(verify.amount) || order.total_amount,
          customerName: verify.cus_name
        });
        if (res.success && !res.alreadyProcessed) result.fulfilled.push(order.order_id);
      } catch (err) {
        console.error(`[PaymentReconciler] Failed for order #${order.order_id}:`, err);
      }
    }
  } catch (err) {
    console.error('[PaymentReconciler] Exception:', err);
  } finally {
    running = false;
  }

  if (result.fulfilled.length) {
    console.log(`[PaymentReconciler] Recovered ${result.fulfilled.length} order(s): ${result.fulfilled.join(', ')}`);
  }
  return result;
}
