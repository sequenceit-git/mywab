import { NextRequest, NextResponse } from 'next/server';
import { zinipayClient } from '@/lib/zinipay/client';
import { db } from '@/lib/db';
import { env } from '@/lib/config/env';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const isConfigured = zinipayClient.isConfigured();
    const isAutoPaymentEnabled = db.isZiniPayAutoPaymentEnabled();
    const appUrl = env.app.url;

    const maskKey = (key: string) => {
      if (!key) return 'Not Configured';
      if (key.length <= 8) return '••••••••';
      return `${key.slice(0, 4)}••••${key.slice(-4)}`;
    };

    return NextResponse.json({
      success: true,
      configured: isConfigured,
      autoPaymentEnabled: isAutoPaymentEnabled,
      apiUrl: env.zinipay.apiUrl,
      apiKeyMasked: maskKey(env.zinipay.apiKey),
      webhookUrl: `${appUrl}/api/webhooks/zinipay`,
      redirectUrl: `${appUrl}/payment/success`,
      cancelUrl: `${appUrl}/payment/cancel`
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'TOGGLE_AUTO_PAYMENT') {
      const enabled = Boolean(body.enabled);
      await db.setSetting(
        'zinipay_auto_payment',
        enabled,
        'Automatic payment link creation and instant verification via ZiniPay API'
      );
      return NextResponse.json({
        success: true,
        autoPaymentEnabled: enabled,
        message: enabled
          ? 'ZiniPay Automatic Payment Link generation is now ON'
          : 'ZiniPay Automatic Payment is now OFF (falls back to manual Send Money numbers)'
      });
    }

    if (action === 'TEST_CREATE_INVOICE') {
      const testAmount = Number(body.amount) || 10;
      const testOrderRef = `TEST-ORDER-${Date.now()}`;
      
      const invoiceRes = await zinipayClient.createInvoice({
        amount: testAmount,
        cus_name: 'Test Customer',
        cus_email: 'test@dsdukan.cloud',
        metadata: {
          test: true,
          order_id: testOrderRef,
          created_at: new Date().toISOString()
        }
      });

      return NextResponse.json(invoiceRes);
    }

    if (action === 'TEST_VERIFY') {
      const { invoiceId } = body;
      if (!invoiceId) {
        return NextResponse.json(
          { success: false, error: 'Invoice ID is required' },
          { status: 400 }
        );
      }
      const verifyRes = await zinipayClient.verifyInvoice(invoiceId);
      return NextResponse.json(verifyRes);
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
