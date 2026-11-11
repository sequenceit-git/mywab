import { connectToDatabase, isDbConfigured } from '../db/client';
import { OrderModel } from '../db/models/Order';
import { hydrateOrder } from '../db/repositories/orders/order-hydrator';
import { db } from '../db';
import { zinipayClient } from '../zinipay/client';
import { whatsappService } from '../whatsapp/service';
import { orderPaymentService } from './order-payment';

// Give the ZiniPay webhook a head start before we poll on its behalf.
const MIN_AGE_MS = 2 * 60 * 1000;
// Payment window: unpaid orders older than this are auto-cancelled.
export const PAYMENT_WINDOW_MS = 30 * 60 * 1000;
// Invoices older than this are ignored entirely.
const MAX_AGE_MS = 48 * 60 * 60 * 1000;
const BATCH_LIMIT = 50;

let running = false;

/**
 * Background sweep over recent PENDING_PAYMENT orders:
 *  - Paid on ZiniPay (missed/failed webhook) → fulfill via handlePaymentVerified (idempotent).
 *  - Still unpaid after the 30-minute payment window → CANCELLED + WhatsApp notice.
 * Orders are only cancelled when ZiniPay explicitly says unpaid (never on API errors).
 */
export async function reconcilePendingPayments(): Promise<{ checked: number; fulfilled: string[]; cancelled: string[] }> {
  const result = { checked: 0, fulfilled: [] as string[], cancelled: [] as string[] };
  if (running || !isDbConfigured()) return result;
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
      const isExpired = now - new Date(order.created_at).getTime() > PAYMENT_WINDOW_MS;
      const invoiceId = order.invoice_id || zinipayClient.extractInvoiceId(order.payment_url || undefined);

      try {
        let isUnpaid = !invoiceId; // no invoice → customer can never pay this order

        if (invoiceId && zinipayClient.isConfigured()) {
          result.checked++;
          const verify = await zinipayClient.verifyInvoice(invoiceId);

          if (verify.status === 'COMPLETED') {
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
            continue;
          }

          // verifyInvoice reports API/network failures as FAILED + error — never cancel on those.
          isUnpaid = !verify.error;
        }

        // Paid-but-stuck orders (trx_id set) are never auto-cancelled.
        if (isExpired && isUnpaid && !order.trx_id) {
          const reason = 'পেমেন্টের সময়সীমা (৩০ মিনিট) শেষ হয়েছে / Payment window (30 min) expired';
          const cancelRes = await db.updateOrderStatus(order.order_id, 'CANCELLED', {
            isAdminOverride: true,
            notes: 'Auto-cancelled: unpaid after 30-minute payment window'
          });
          if (cancelRes.success) {
            result.cancelled.push(order.order_id);
            whatsappService.sendOrderCancelledNotification(cancelRes.order || order, reason).catch(err => {
              console.error(`[PaymentReconciler] Cancel notice failed for #${order.order_id}:`, err);
            });
          }
        }
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
  if (result.cancelled.length) {
    console.log(`[PaymentReconciler] Auto-cancelled ${result.cancelled.length} unpaid order(s): ${result.cancelled.join(', ')}`);
  }
  return result;
}
