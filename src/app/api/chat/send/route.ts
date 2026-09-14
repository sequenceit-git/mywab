import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { whatsappService } from '@/lib/whatsapp/service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId, content, isAiActive, phone } = body;

    if (isAiActive !== undefined && conversationId) {
      await db.setAiMode(conversationId, isAiActive);
      return NextResponse.json({ success: true, isAiActive });
    }

    if (conversationId && content) {
      const msg = await db.addMessage(conversationId, 'ADMIN', content);
      
      if (phone) {
        await whatsappService.sendMessage(phone, content);
      }

      return NextResponse.json({ success: true, message: msg });
    }

    return NextResponse.json({ success: false, message: 'Invalid payload' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
