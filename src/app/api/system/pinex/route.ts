import { NextResponse } from 'next/server';
import { pinexClient } from '@/lib/pinex/client';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const isConfigured = pinexClient.isConfigured();
    const isAutoFulfillEnabled = db.isPinexAutoFulfillEnabled();

    return NextResponse.json({
      success: true,
      configured: isConfigured,
      autoFulfillEnabled: isAutoFulfillEnabled,
      endpoint: pinexClient.getEndpointUrl()
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'TOGGLE_AUTO_FULFILL') {
      const enabled = Boolean(body.enabled);
      await db.setSetting(
        'pinex_ff_auto_fulfill',
        enabled,
        'Automatic Free Fire Diamonds & Shells redemption via Pinex API'
      );
      return NextResponse.json({
        success: true,
        autoFulfillEnabled: enabled,
        message: enabled
          ? 'Free Fire Auto-Fulfillment via Pinex API is now ON'
          : 'Free Fire Auto-Fulfillment is now OFF'
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unknown action' },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
