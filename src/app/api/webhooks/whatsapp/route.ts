import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { whatsappService } from '@/lib/whatsapp/service';
import { env } from '@/lib/config/env';
import { stateBot } from '@/lib/chat/state-bot';
import { parseSlashCommand } from '@/lib/chat/input-parser';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// In-memory TTL deduplication — prevents Meta duplicate webhook deliveries
// ---------------------------------------------------------------------------
const processedMessageMap = new Map<string, number>();
const inFlightMessages = new Set<string>();
const MESSAGE_CACHE_TTL_MS = 10 * 60 * 1000;

function isDuplicateOrInFlight(messageId: string): boolean {
  if (!messageId) return false;
  const now = Date.now();
  for (const [id, time] of processedMessageMap.entries()) {
    if (now - time > MESSAGE_CACHE_TTL_MS) processedMessageMap.delete(id);
  }
  if (processedMessageMap.has(messageId) || inFlightMessages.has(messageId)) return true;
  inFlightMessages.add(messageId);
  processedMessageMap.set(messageId, now);
  return false;
}

function releaseInFlight(messageId: string): void {
  if (messageId) inFlightMessages.delete(messageId);
}

// ---------------------------------------------------------------------------
// Resolve raw WhatsApp message payload -> { text, buttonId }
// ---------------------------------------------------------------------------
function resolveIncoming(message: any): { text: string; buttonId: string | null } {
  let text = '';
  let buttonId: string | null = null;

  if (message.type === 'text') {
    text = message.text?.body?.trim() || '';
  } else if (message.type === 'interactive') {
    const btnReply  = message.interactive?.button_reply;
    const listReply = message.interactive?.list_reply;
    buttonId = btnReply?.id || listReply?.id || null;
    text     = btnReply?.title || listReply?.title || buttonId || '';
  } else if (message.type === 'button') {
    buttonId = message.button?.payload || null;
    text     = message.button?.text || buttonId || '';
  }

  return { text, buttonId };
}

// ---------------------------------------------------------------------------
// GET - Meta webhook verification handshake
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode      = searchParams.get('hub.mode');
  const token     = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  console.log(`[Webhook Handshake] mode=${mode} token=${token}`);

  if (mode === 'subscribe' && token === env.whatsapp.verifyToken) {
    console.log('OK [Webhook] Verified with Meta');
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn('FAIL [Webhook] Token mismatch. Got:', token, 'Expected:', env.whatsapp.verifyToken);
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// ---------------------------------------------------------------------------
// POST - Inbound message processing
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[Webhook POST]:\n', JSON.stringify(body, null, 2));

    const entries = body.entry || [];
    if (entries.length === 0) return NextResponse.json({ status: 'no_entries' }, { status: 200 });

    for (const entry of entries) {
      for (const change of (entry.changes || [])) {
        const value = change.value;
        if (!value) continue;

        // Delivery / read status updates
        if (value.statuses?.length > 0) {
          for (const s of value.statuses) {
            console.log(`[Status] id=${s.id} recipient=${s.recipient_id} status=${s.status}`);
          }
        }

        const messages = value.messages || [];
        if (messages.length === 0) continue;

        for (const message of messages) {
          if (isDuplicateOrInFlight(message.id)) {
            console.log(`[Dedup] Skipping duplicate message ${message.id}`);
            continue;
          }

          try {
            const fromPhone      = message.from;
            const formattedPhone = fromPhone.startsWith('+') ? fromPhone : `+${fromPhone}`;
            const customerName   = value.contacts?.[0]?.profile?.name || 'Customer';
            const { text: messageText, buttonId } = resolveIncoming(message);

            console.log(`[Inbound] from=${formattedPhone} (${customerName}) text="${messageText}" buttonId=${buttonId} type=${message.type} id=${message.id}`);

            // Mark as read + typing indicator
            if (message.id) {
              whatsappService.markAsReadAndType(message.id).catch(err => {
                console.warn(`[Read/Type Error] ${message.id}:`, err);
              });
            }

            // Skip empty (image, sticker, voice, etc.)
            if (!messageText && !buttonId) {
              console.log(`[Inbound] Unsupported type: ${message.type} - ignoring`);
              continue;
            }

            // Persist user + conversation + message
            const user = await db.getOrCreateUser(formattedPhone, customerName);
            const conversation = await db.getOrCreateConversation(formattedPhone, customerName);
            await db.addMessage(conversation.id, 'CUSTOMER', messageText || buttonId || '');

            console.log(`[DB] Saved | conv=${conversation.id} | phone=${formattedPhone} | is_ai_active=${conversation.is_ai_active}`);

            // Check if user is requesting to re-enable the AI bot
            const slash = parseSlashCommand(messageText);
            const wantsBotReenable = slash?.command === 'bot' || slash?.command === 'menu' || buttonId === 'btn_main_menu';

            if (wantsBotReenable && !conversation.is_ai_active) {
              console.log(`[Bot Re-enabled] Activating AI bot for ${formattedPhone} via command /${slash?.command || buttonId}`);
              await db.setAiMode(conversation.id, true);
              conversation.is_ai_active = true;
            }

            // If Human Takeover is ACTIVE (is_ai_active is false), DO NOT allow the bot to auto-reply!
            if (!conversation.is_ai_active) {
              console.log(`[Human Takeover] AI Bot is paused for ${formattedPhone}. Inbound message saved to admin inbox.`);
              continue;
            }

            // Process with deterministic sequential State Bot
            await stateBot.handleIncomingMessage({
              conversationId: conversation.id,
              userId: user.id,
              phone: formattedPhone,
              customerName,
              text: messageText,
              buttonId: buttonId || undefined,
              listId: message.interactive?.list_reply?.id || undefined
            });

          } finally {
            releaseInFlight(message.id);
          }
        }
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[Webhook Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
