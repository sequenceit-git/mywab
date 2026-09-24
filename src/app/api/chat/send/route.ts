import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { whatsappService } from '@/lib/whatsapp/service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId, content, isAiActive, phone, action, statusTag, userId } = body;

    // 1. Action: Reset Bot Session flow to IDLE
    if (action === 'RESET_SESSION' && conversationId) {
      db.clearSessionDraft(conversationId);
      return NextResponse.json({ success: true, message: 'Session draft reset to IDLE' });
    }

    // 2. Action: Update customer tag (VIP / REGULAR / FLAGGED)
    if (action === 'UPDATE_TAG' && statusTag) {
      if (userId) {
        await db.updateUserStatus(userId, statusTag);
      }
      return NextResponse.json({ success: true, statusTag });
    }

    // 3. Action: Toggle AI Bot Mode (Autonomous Bot vs Human Agent Takeover)
    if (isAiActive !== undefined && conversationId) {
      await db.setAiMode(conversationId, isAiActive);
      return NextResponse.json({ success: true, isAiActive });
    }

    // 4. Action: Send Admin WhatsApp Message
    if (conversationId && content && content.trim()) {
      const cleanContent = content.trim();
      const msg = await db.addMessage(conversationId, 'ADMIN', cleanContent);

      let deliveryResult: any = { success: true };
      if (phone) {
        try {
          deliveryResult = await whatsappService.sendMessage(phone, cleanContent);
        } catch (waErr) {
          console.warn('[WhatsApp Send Warning]:', waErr);
          deliveryResult = { success: false, error: String(waErr) };
        }
      }

      return NextResponse.json({
        success: true,
        message: msg,
        delivery: deliveryResult
      });
    }

    return NextResponse.json({ success: false, message: 'Invalid payload' }, { status: 400 });
  } catch (error) {
    console.error('[API Chat Send Error]:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
