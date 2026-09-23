import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/config/env';
import { baileysManager } from '@/lib/baileys';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const status = baileysManager.getStatus();

    // Auto-initialize if provider is set to baileys and status is DISCONNECTED
    if (env.whatsapp.provider === 'baileys' && status.status === 'DISCONNECTED') {
      baileysManager.init().catch(err => {
        console.error('[Baileys API GET] Auto-init error:', err);
      });
    }

    return NextResponse.json({
      success: true,
      provider: env.whatsapp.provider,
      ...status
    });
  } catch (err: any) {
    console.error('[Baileys API GET Error]:', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Failed to fetch Baileys status'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, phone } = body;

    switch (action) {
      case 'REQUEST_PAIRING_CODE': {
        if (!phone || typeof phone !== 'string') {
          return NextResponse.json({
            success: false,
            error: 'Phone number is required for pairing code generation'
          }, { status: 400 });
        }

        const res = await baileysManager.requestPairingCode(phone);
        if (!res.success) {
          return NextResponse.json(res, { status: 400 });
        }

        const currentStatus = baileysManager.getStatus();
        return NextResponse.json({
          success: true,
          ...currentStatus,
          pairingCode: res.code || currentStatus.pairingCode
        });
      }

      case 'RECONNECT': {
        await baileysManager.reconnect();
        return NextResponse.json({
          success: true,
          message: 'Baileys reconnecting...',
          ...baileysManager.getStatus()
        });
      }

      case 'INIT': {
        await baileysManager.init();
        return NextResponse.json({
          success: true,
          message: 'Baileys initializing...',
          ...baileysManager.getStatus()
        });
      }

      case 'RESET_SESSION': {
        await baileysManager.resetSession();
        return NextResponse.json({
          success: true,
          message: 'Baileys auth wiped and fresh session started.',
          ...baileysManager.getStatus()
        });
      }

      case 'LOGOUT': {
        await baileysManager.logout();
        return NextResponse.json({
          success: true,
          message: 'Baileys session logged out and cleared.',
          ...baileysManager.getStatus()
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`
        }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[Baileys API POST Error]:', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Internal server error processing Baileys action'
    }, { status: 500 });
  }
}
