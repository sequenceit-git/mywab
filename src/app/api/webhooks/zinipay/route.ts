import { NextRequest, NextResponse } from 'next/server';
import { zinipayClient } from '@/lib/zinipay/client';
import { orderPaymentService } from '@/lib/services/order-payment';

export const dynamic = 'force-dynamic';

/**
 * GET - Diagnostic / Health Check for ZiniPay Webhook endpoint
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    service: 'ZiniPay Webhook Listener',
    status: 'ACTIVE',
    configured: zinipayClient.isConfigured(),
    timestamp: new Date().toISOString()
  });
}

/**
 * POST - Inbound Webhook Callback from ZiniPay
 * Payload: { "invoice_id": "INVOICE_ID", "status": "true" }
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    console.log('[ZiniPay Webhook Inbound POST]:', rawBody);

    let body: any = {};
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const invoiceId = body.invoice_id || body.invoiceId || body.id;

    if (!invoiceId) {
      console.warn('[ZiniPay Webhook Warning]: No invoice_id in payload:', body);
      return NextResponse.json(
        { success: false, error: 'Missing invoice_id' },
        { status: 400 }
      );
    }

    console.log(`[ZiniPay Webhook] Verifying invoice ${invoiceId} against ZiniPay API...`);

    // Authoritative server-side verification with ZiniPay
    const verifyResult = await zinipayClient.verifyInvoice(invoiceId);

    console.log(`[ZiniPay Webhook Verification Result]:`, JSON.stringify(verifyResult));

    if (verifyResult.status === 'COMPLETED') {
      const trxId = verifyResult.transaction_id || `ZINI-${Date.now()}`;
      const paymentMethod = verifyResult.payment_method || 'bKash';
      const amount = Number(verifyResult.amount) || 0;

      const processRes = await orderPaymentService.handlePaymentVerified({
        invoiceId,
        trxId,
        paymentMethod,
        amount,
        customerName: verifyResult.cus_name
      });

      console.log(`[ZiniPay Webhook Fulfillment Result]:`, JSON.stringify(processRes));

      return NextResponse.json({
        success: true,
        message: 'Payment verified and order fulfilled successfully',
        processResult: processRes
      });
    }

    console.log(`[ZiniPay Webhook] Invoice ${invoiceId} status is ${verifyResult.status} (not COMPLETED). No fulfillment triggered.`);

    return NextResponse.json({
      success: true,
      message: `Invoice status is ${verifyResult.status}`
    });
  } catch (err: any) {
    console.error('[ZiniPay Webhook Exception]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
