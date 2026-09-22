import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { whatsappService } from '@/lib/whatsapp/service';
import { telegramBot } from '@/lib/telegram/bot';

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

    // Handle manual re-dispatch to Telegram Worker Group
    if (action === 'redispatch') {
      const order = await db.getOrderByCode(id);
      if (!order) {
        return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
      }
      const dispatchResult = await telegramBot.dispatchNewOrder(order);
      return NextResponse.json(dispatchResult);
    }

    // Handle claim action from web/API
    if (action === 'claim' && telegramUserId && workerName) {
      const claimResult = await db.claimOrderAtomic({
        orderIdCode: id,
        telegramUserId,
        workerName
      });

      if (claimResult.success && claimResult.order) {
        // Sync Telegram Group Card
        telegramBot.syncOrderStatus(claimResult.order, { deletePrevious: true, workerName }).catch(err => {
          console.error('[API Order Claim] Telegram sync error:', err);
        });

        // Notify customer on WhatsApp
        whatsappService.sendOrderClaimedNotification(claimResult.order, workerName).catch(err => {
          console.error('[API Order Claim] WhatsApp notify error:', err);
        });
      }

      return NextResponse.json(claimResult);
    }

    // Handle status update from Admin Panel (e.g. OUT_FOR_DELIVERY, DELIVERED, CANCELLED, etc.)
    if (status) {
      const updateResult = await db.updateOrderStatus(id, status, { isAdminOverride: true });
      if (updateResult.success && updateResult.order) {
        // Sync Telegram Group Card (Delete previous stale message and post updated state card)
        telegramBot.syncOrderStatus(updateResult.order, { deletePrevious: true }).catch(err => {
          console.error('[API Order Status] Telegram sync error:', err);
        });

        if (status === 'DELIVERED') {
          whatsappService.sendOrderDeliveredNotification(updateResult.order).catch(err => {
            console.error('[API Order Status] WhatsApp delivery notify error:', err);
          });
        } else if (status === 'CANCELLED') {
          const reason = body.reason || body.cancellationReason;
          whatsappService.sendOrderCancelledNotification(updateResult.order, reason).catch(err => {
            console.error('[API Order Status] WhatsApp cancellation notify error:', err);
          });
        }
      }
      return NextResponse.json(updateResult);
    }

    return NextResponse.json({ success: false, message: 'Invalid payload' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
