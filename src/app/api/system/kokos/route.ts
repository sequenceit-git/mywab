import { NextResponse } from 'next/server';
import { kokosClient } from '@/lib/kokos/client';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const checkInventory = searchParams.get('inventory') === 'true';

    const isConfigured = kokosClient.isConfigured();
    const isAutoFulfillEnabled = db.isKokosAutoFulfillEnabled();

    let inventory: Record<string, number> | null = null;
    let inventoryError: string | null = null;

    if (checkInventory && isConfigured) {
      const invRes = await kokosClient.getInventory();
      if (invRes.success && invRes.inventory) {
        inventory = invRes.inventory;
      } else {
        inventoryError = invRes.error || 'Failed to fetch inventory';
      }
    }

    return NextResponse.json({
      success: true,
      configured: isConfigured,
      autoFulfillEnabled: isAutoFulfillEnabled,
      inventory,
      inventoryError
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
        'kokos_pubg_auto_fulfill',
        enabled,
        'Automatic PUBG Mobile UID redemption via Kokos Activator API'
      );
      return NextResponse.json({
        success: true,
        autoFulfillEnabled: enabled,
        message: enabled
          ? 'PUBG UID Auto-Fulfillment via Kokos API is now ON'
          : 'PUBG UID Auto-Fulfillment is now OFF (dispatches to Telegram Worker Bot)'
      });
    }

    if (action === 'TEST_LOOKUP') {
      const { playerId } = body;
      if (!playerId) {
        return NextResponse.json(
          { success: false, error: 'Player ID is required' },
          { status: 400 }
        );
      }
      const charRes = await kokosClient.getCharacter(playerId, 'pubg_mobile');
      return NextResponse.json(charRes);
    }

    if (action === 'TEST_INVENTORY') {
      const invRes = await kokosClient.getInventory();
      return NextResponse.json(invRes);
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
