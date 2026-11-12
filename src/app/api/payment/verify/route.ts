import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { zinipayClient } from '@/lib/zinipay/client';
import { orderPaymentService } from '@/lib/services/order-payment';

export const dynamic = 'force-dynamic';

/**
 * Public endpoint used by the /payment/success page right after the ZiniPay redirect.
 * Verifies the invoice server-side with ZiniPay (authoritative) instead of waiting for the
 * webhook, then runs the idempotent fulfillment path. Returns only non-sensitive status fields.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = (searchParams.get('order_id') || searchParams.get('orderId') || '').trim();
    const invoiceParam = (searchParams.get('invoice_id') || searchParams.get('invoiceId') || '').trim();

    if (!orderId && !invoiceParam) {
      return NextResponse.json({ success: false, error: 'order_id or invoice_id required' }, { status: 400 });
    }

    let order = orderId ? await db.getOrderByCode(orderId) : null;
    if (!order && invoiceParam) order = await db.getOrderByInvoiceId(invoiceParam);
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    if (order.status === 'PENDING_PAYMENT' && zinipayClient.isConfigured()) {
      // The order's own invoice is authoritative; never trust a query-string invoice for a different order.
      const invoiceId = order.invoice_id || zinipayClient.extractInvoiceId(order.payment_url || undefined);
      if (invoiceId) {
        const verify = await zinipayClient.verifyInvoice(invoiceId);
        if (verify.status === 'COMPLETED') {
          const res = await orderPaymentService.handlePaymentVerified({
            orderIdCode: order.order_id,
            invoiceId,
            trxId: verify.transaction_id || `ZINI-${Date.now()}`,
            paymentMethod: verify.payment_method || 'bKash',
            amount: Number(verify.amount) || order.total_amount,
            customerName: verify.cus_name
          });
          order = res.order || (await db.getOrderByCode(order.order_id)) || order;
        }
      }
    }

    return NextResponse.json({
      success: true,
      order: {
        order_id: order.order_id,
        status: order.status,
        total_amount: order.total_amount,
        items: (order.items || []).slice(0, 1).map(i => ({ product_name: i.product_name }))
      }
    });
  } catch (err: any) {
    console.error('[Payment Verify Endpoint Error]:', err);
    return NextResponse.json({ success: false, error: 'Verification failed' }, { status: 500 });
  }
}
