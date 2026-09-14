import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { langChainAgent } from '@/lib/ai/langchain-agent';
import { whatsappService } from '@/lib/whatsapp/service';
import { env } from '@/lib/config/env';

/**
 * WhatsApp Cloud API Webhook Verification (GET)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === env.whatsapp.verifyToken) {
    console.log('WhatsApp Webhook verified successfully!');
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

/**
 * WhatsApp Cloud API Ingestion Webhook (POST)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Check if this is a WhatsApp status update or message event
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) {
      return NextResponse.json({ status: 'ignored_or_status_update' }, { status: 200 });
    }

    const fromPhone = message.from; // e.g. "8801700000001"
    const formattedPhone = fromPhone.startsWith('+') ? fromPhone : `+${fromPhone}`;
    const customerName = value?.contacts?.[0]?.profile?.name || 'Customer';
    const messageText = message.text?.body || '';

    if (!messageText) {
      return NextResponse.json({ status: 'non_text_received' }, { status: 200 });
    }

    // 1. Get or create customer profile
    const user = await db.getOrCreateUser(formattedPhone, customerName);

    // 2. Get or create conversation
    const conversation = await db.getOrCreateConversation(user.id);

    // 3. Save incoming customer message
    await db.addMessage(conversation.id, 'CUSTOMER', messageText);

    // 4. If AI is active for this conversation, process via LangChain
    if (conversation.is_ai_active) {
      const aiReply = await langChainAgent.processMessage({
        phone: formattedPhone,
        messageText,
        conversationId: conversation.id
      });

      // Save Bot message to DB
      await db.addMessage(conversation.id, 'BOT', aiReply);

      // Send reply back to customer's WhatsApp
      await whatsappService.sendMessage(formattedPhone, aiReply);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('WhatsApp Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
