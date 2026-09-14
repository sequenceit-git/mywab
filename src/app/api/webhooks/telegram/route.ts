import { NextRequest, NextResponse } from 'next/server';
import { telegramBot } from '@/lib/telegram/bot';
import { env } from '@/lib/config/env';

/**
 * Telegram Bot Webhook Receiver (POST)
 */
export async function POST(request: NextRequest) {
  try {
    const update = await request.json();

    // 1. Handle Inline Keyboard Button Callbacks (Claim, Processing, Delivered)
    if (update.callback_query) {
      const result = await telegramBot.handleCallbackQuery(update.callback_query);
      return NextResponse.json(result, { status: 200 });
    }

    // 2. Handle Text Messages in Worker Group (Commands like /start, /help)
    if (update.message?.text) {
      const text = update.message.text.trim();
      const chatId = update.message.chat.id;

      if (text === '/start' || text === '/help') {
        const welcomeText = 
`👋 <b>WapBusiness Worker Bot</b>

এই বটটির মাধ্যমে নতুন অর্ডার নোটিফিকেশন আসবে এবং আপনি সরাসরি ক্লেইম (Claim) করে ডেলিভারি পরিচালনা করতে পারবেন।

Commands:
• /stats - আপনার ডেলিভারি পরিসংখ্যান
• /help - সহায়তা`;

        if (env.telegram.isConfigured) {
          await fetch(`${env.telegram.apiUrl}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: welcomeText,
              parse_mode: 'HTML'
            })
          });
        }
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error('Telegram Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
