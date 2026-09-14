import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { telegramBot } from '@/lib/telegram/bot';
import { whatsappService } from '@/lib/whatsapp/service';

export async function GET() {
  try {
    const orders = await db.getOrders();
    return NextResponse.json({ success: true, orders });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, customerName, address, items, notes } = body;

    const user = await db.getOrCreateUser(phone, customerName, address);

    const order = await db.createOrder({
      userId: user.id,
      items: items || [],
      deliveryAddress: {
        name: customerName,
        phone,
        address
      },
      deliveryPhone: phone,
      customerNotes: notes
    });

    // Auto dispatch to Telegram worker group
    await telegramBot.dispatchNewOrder(order);

    // Auto send confirmation to WhatsApp
    await whatsappService.sendOrderConfirmation(order);

    return NextResponse.json({ success: true, order }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
