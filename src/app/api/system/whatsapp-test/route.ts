import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/config/env';
import { whatsappService } from '@/lib/whatsapp/service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const targetPhone = body.phone || '8801705785272';
    const cleanPhone = targetPhone.replace(/\D/g, '');

    const results: {
      wabaSubscription?: any;
      testMessage?: any;
      error?: string;
    } = {};

    // 1. Subscribe WABA to the App (Fixes the Meta "Shadow Delivery" webhook issue)
    const wabaId = env.whatsapp.businessAccountId || '1623278632801431';
    if (wabaId && env.whatsapp.accessToken) {
      try {
        console.log(`[WABA Subscription] Subscribing app to WABA: ${wabaId}...`);
        const subRes = await fetch(`${env.whatsapp.apiUrl}/${wabaId}/subscribed_apps`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.whatsapp.accessToken}`,
            'Content-Type': 'application/json',
          },
        });
        const subData = await subRes.json();
        results.wabaSubscription = subData;
        console.log('[WABA Subscription Result]:', subData);
      } catch (err) {
        console.error('[WABA Subscription Exception]:', err);
        results.wabaSubscription = { error: String(err) };
      }
    }

    // 2. Send test message to customer WhatsApp
    const testMessageText = `👋 *আসসালামু আলাইকুম!* WapBusiness থেকে টেস্ট মেসেজ পাঠানো হয়েছে। AI স্মার্ট অ্যাসিস্ট্যান্ট সফলভাবে সংযুক্ত হয়েছে! 🚀`;
    const sendResult = await whatsappService.sendMessage(cleanPhone, testMessageText);
    results.testMessage = sendResult;

    return NextResponse.json({
      success: sendResult.success,
      phone: cleanPhone,
      results
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
