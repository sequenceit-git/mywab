import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/config/env';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!env.telegram.botToken) {
    return NextResponse.json(
      { success: false, error: 'TELEGRAM_BOT_TOKEN is not configured in .env' },
      { status: 400 }
    );
  }

  const hostHeader = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const protoHeader = request.headers.get('x-forwarded-proto') || (request.url.startsWith('https') || hostHeader.includes('ngrok') ? 'https' : 'http');
  
  let activeUrl = '';
  if (hostHeader && (hostHeader.includes('ngrok') || !process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL.includes('localhost'))) {
    activeUrl = `${protoHeader}://${hostHeader}`;
  } else {
    activeUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || `${protoHeader}://${hostHeader}`;
  }
  if (!activeUrl) {
    activeUrl = env.app.url;
  }

  const webhookUrl = `${activeUrl}/api/webhooks/telegram`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${env.telegram.botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query']
      })
    });

    const data = await response.json();
    return NextResponse.json({
      success: data.ok,
      telegramResponse: data,
      webhookUrl
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
