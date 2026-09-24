import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') || searchParams.get('conversationId');

    if (id) {
      const conversation = await db.getConversationById(id);
      if (!conversation) {
        return NextResponse.json({ success: false, error: 'Conversation not found' }, { status: 404 });
      }

      // Fetch customer's orders if phone or user_id exists
      let orders: any[] = [];
      try {
        const allOrders = await db.getOrders();
        const userPhone = conversation.user?.phone_number || (conversation as any).phone;
        const cleanPhone = userPhone ? userPhone.replace(/\D/g, '') : '';

        orders = allOrders.filter(o => {
          if (conversation.user_id && o.user_id === conversation.user_id) return true;
          if (cleanPhone && o.delivery_phone && o.delivery_phone.replace(/\D/g, '') === cleanPhone) return true;
          return false;
        }).slice(0, 10);
      } catch (err) {
        console.warn('[API Chat GET Orders warning]:', err);
      }

      return NextResponse.json({
        success: true,
        conversation,
        orders
      });
    }

    const conversations = await db.getConversations();

    // Aggregate quick stats
    const total = conversations.length;
    let botActiveCount = 0;
    let humanModeCount = 0;
    let awaitingPaymentCount = 0;
    let inProgressCount = 0;

    for (const c of conversations) {
      if (c.is_ai_active) {
        botActiveCount++;
      } else {
        humanModeCount++;
      }

      const step = c.draft_state?.step || c.session_state?.step || 'IDLE';
      if (step === 'AWAITING_PAYMENT') {
        awaitingPaymentCount++;
      }
      if (step !== 'IDLE') {
        inProgressCount++;
      }
    }

    return NextResponse.json({
      success: true,
      conversations,
      stats: {
        total,
        botActive: botActiveCount,
        humanMode: humanModeCount,
        awaitingPayment: awaitingPaymentCount,
        inProgress: inProgressCount
      }
    });
  } catch (error) {
    console.error('[API Chat GET error]:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
