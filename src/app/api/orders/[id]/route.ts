import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { whatsappService } from '@/lib/whatsapp/service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const order = await db.getOrderByCode(id);
    if (!order) {
      return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, order });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, action, telegramUserId, workerName } = body;

    // Handle claim action from web/API
    if (action === 'claim' && telegramUserId && workerName) {
      const claimResult = await db.claimOrderAtomic({
        orderIdCode: id,
        telegramUserId,
        workerName
      });

      if (claimResult.success && claimResult.order) {
        await whatsappService.sendOrderClaimedNotification(claimResult.order, workerName);
      }

      return NextResponse.json(claimResult);
    }

    // Handle status update (e.g. DELIVERED)
    if (status) {
      const updateResult = await db.updateOrderStatus(id, status);
      if (updateResult.success && updateResult.order && status === 'DELIVERED') {
        await whatsappService.sendOrderDeliveredNotification(updateResult.order);
      }
      return NextResponse.json(updateResult);
    }

    return NextResponse.json({ success: false, message: 'Invalid payload' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
