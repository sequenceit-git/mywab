import { NextRequest, NextResponse } from 'next/server';
import { whatsappService } from '@/lib/whatsapp/service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const targetPhone = body.phone || '8801705785272';
    const cleanPhone = targetPhone.replace(/\D/g, '');

    // Send test message to customer WhatsApp via Baileys
    const testMessageText = `👋 *আসসালামু আলাইকুম!* WapBusiness থেকে টেস্ট মেসেজ পাঠানো হয়েছে। Baileys WhatsApp Web সফলভাবে সংযুক্ত হয়েছে! 🚀`;
    const sendResult = await whatsappService.sendMessage(cleanPhone, testMessageText);

    return NextResponse.json({
      success: sendResult.success,
      phone: cleanPhone,
      messageId: sendResult.messageId,
      error: sendResult.error
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
