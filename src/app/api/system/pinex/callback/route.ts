import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { whatsappService } from '@/lib/whatsapp/service';

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    console.log('[Pinex Callback Received]:', rawBody);

    let body: any = {};
    try {
      body = JSON.parse(rawBody);
    } catch (e) {
      console.warn('[Pinex Callback] Non-JSON payload received:', rawBody);
      return NextResponse.json({ received: true, note: 'non_json' });
    }

    const { type, status, orderid, nickname, content } = body;
    const orderId = String(orderid || '').trim();

    if (!orderId) {
      return NextResponse.json({ received: true, warning: 'missing_orderid' });
    }

    // Lookup order in DB
    const order = await db.getOrderById(orderId);
    if (!order) {
      console.warn(`[Pinex Callback] Order #${orderId} not found in database`);
      return NextResponse.json({ received: true, warning: 'order_not_found' });
    }

    const normalizedStatus = String(status || '').toLowerCase().trim();

    if (normalizedStatus === 'sucess' || normalizedStatus === 'success') {
      console.log(`[Pinex Callback Success] Order #${orderId} fulfilled! Nickname: ${nickname}, TRX: ${content}`);

      // Update Order Status to DELIVERED
      await db.updateOrderStatus(orderId, 'DELIVERED', {
        isAdminOverride: true,
        notes: `Pinex Free Fire Auto-Fulfilled | TRX: ${content || 'N/A'} | Player Nickname: ${nickname || order.player_uid}`
      });

      // Send automated WhatsApp delivery confirmation to customer if order wasn't already delivered
      if (order.status !== 'DELIVERED' && order.delivery_phone) {
        const item = order.items?.[0];
        const productName = item?.product_name || 'Free Fire Diamonds';
        const deliveryMsg = 
`🎉 *Free Fire ডায়মন্ড টপ-আপ সফলভাবে সম্পন্ন হয়েছে!*

🔥 *সার্ভিস:* Free Fire (Direct UID Top-Up)
👤 *Player Name:* \`${nickname || 'In-Game Player'}\`
🆔 *Player UID:* \`${order.player_uid || 'N/A'}\`
💎 *প্যাকেজ:* *${productName}*
🧾 *Pinex TRX ID:* \`${content || 'COMPLETED'}\`
💰 *অর্ডার আইডি:* \`#${order.order_id}\`

আপনার অ্যাকাউন্টে ডায়মন্ড যোগ হয়ে গেছে। ধন্যবাদ সাথে থাকার জন্য! ❤️`;

        const buttons = [
          { id: 'btn_main_menu', title: '🎮 নতুন অর্ডার করুন' },
          { id: `track:${order.order_id}`, title: '📦 অর্ডার বিস্তারিত' }
        ];

        await whatsappService.sendInteractiveButtons(
          order.delivery_phone,
          deliveryMsg,
          buttons,
          'টপ-আপ ডেলিভারি সম্পন্ন'
        ).catch(err => {
          console.warn('[Pinex Callback] WhatsApp message send error:', err);
        });
      }
    } else {
      console.warn(`[Pinex Callback Failure] Order #${orderId} failed: ${content}`);
      await db.updateOrderStatus(orderId, 'PROCESSING', {
        notes: `⚠️ Pinex Auto-Fulfill Failed: ${content || 'Unknown Error'} | Needs manual review`
      });
    }

    return NextResponse.json({ received: true, status: normalizedStatus });
  } catch (err: any) {
    console.error('[Pinex Callback Error]:', err);
    return NextResponse.json({ received: false, error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Pinex callback webhook is live and listening for POST notifications'
  });
}
