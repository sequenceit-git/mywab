import { NextResponse } from 'next/server';
import { env } from '@/lib/config/env';

export async function POST() {
  if (!env.telegram.botToken) {
    return NextResponse.json(
      { success: false, error: 'TELEGRAM_BOT_TOKEN is not configured in .env' },
      { status: 400 }
    );
  }

  const webhookUrl = `${env.app.url}/api/webhooks/telegram`;

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
