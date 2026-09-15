import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { langChainAgent } from '@/lib/ai/langchain-agent';
import { whatsappService } from '@/lib/whatsapp/service';
import { env } from '@/lib/config/env';

export const dynamic = 'force-dynamic';

// In-memory TTL deduplication cache for Meta WhatsApp webhook events
const processedMessageMap = new Map<string, number>();
const inFlightMessages = new Set<string>();
const MESSAGE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function isDuplicateOrInFlight(messageId: string): boolean {
  if (!messageId) return false;
  const now = Date.now();

  // Clean expired entries
  for (const [id, time] of processedMessageMap.entries()) {
    if (now - time > MESSAGE_CACHE_TTL_MS) {
      processedMessageMap.delete(id);
    }
  }

  if (processedMessageMap.has(messageId) || inFlightMessages.has(messageId)) {
    return true;
  }

  inFlightMessages.add(messageId);
  processedMessageMap.set(messageId, now);
  return false;
}

function releaseInFlight(messageId: string): void {
  if (messageId) {
    inFlightMessages.delete(messageId);
  }
}

/**
 * WhatsApp Cloud API Webhook Verification (GET)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  console.log(`[WhatsApp Webhook Handshake] mode=${mode}, token=${token}, challenge=${challenge}`);

  if (mode === 'subscribe' && token === env.whatsapp.verifyToken) {
    console.log('✅ [WhatsApp Webhook Handshake] Verified successfully with Meta!');
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn('❌ [WhatsApp Webhook Handshake] Token mismatch. Received:', token, 'Expected:', env.whatsapp.verifyToken);
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

/**
 * WhatsApp Cloud API Ingestion Webhook (POST)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('📥 [WhatsApp Webhook POST Received]:\n', JSON.stringify(body, null, 2));

    const entries = body.entry || [];
    if (entries.length === 0) {
      console.log('ℹ️ [WhatsApp Webhook] No entries in payload');
      return NextResponse.json({ status: 'no_entries' }, { status: 200 });
    }

    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value;
        if (!value) continue;

        // 1. If status update (sent, delivered, read), log and acknowledge
        if (value.statuses && value.statuses.length > 0) {
          for (const status of value.statuses) {
            console.log(`📊 [WhatsApp Status Update] Message ID: ${status.id} | Recipient: ${status.recipient_id} | Status: ${status.status}`);
          }
        }

        // 2. If incoming customer messages exist
        const messages = value.messages || [];
        if (messages.length === 0) {
          continue;
        }

        for (const message of messages) {
          // Deduplication: Avoid processing the exact same webhook message multiple times
          if (message.id && isDuplicateOrInFlight(message.id)) {
            console.log(`⚡ [WhatsApp Deduplication] Message ID ${message.id} already processed or in-flight. Skipping duplicate execution.`);
            continue;
          }
          const fromPhone = message.from; // e.g. "8801705785272"
          const formattedPhone = fromPhone.startsWith('+') ? fromPhone : `+${fromPhone}`;
          const customerName = value.contacts?.[0]?.profile?.name || 'Customer';
          
          // Extract message text or button click response with robust action routing
          let messageText = '';
          if (message.type === 'text') {
            messageText = message.text?.body || '';
          } else if (message.type === 'interactive') {
            const replyId = message.interactive?.button_reply?.id || message.interactive?.list_reply?.id || '';
            const replyTitle = message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || '';
            
            if (replyId.startsWith('track:')) {
              const orderId = replyId.replace('track:', '').trim();
              messageText = `Track order ${orderId}`;
            } else if (replyId === 'btn_60uc') {
              messageText = '60 UC nibo';
            } else if (replyId === 'btn_385uc') {
              messageText = '385 UC nibo';
            } else if (replyId === 'btn_catalog') {
              messageText = 'UC price list koto';
            } else if (replyId === 'btn_website') {
              messageText = 'Website discount link den';
            } else {
              messageText = replyTitle || replyId;
            }
          } else if (message.type === 'button') {
            const payload = message.button?.payload || '';
            const text = message.button?.text || '';
            if (payload.startsWith('track:')) {
              messageText = `Track order ${payload.replace('track:', '').trim()}`;
            } else if (payload === 'btn_60uc') {
              messageText = '60 UC nibo';
            } else if (payload === 'btn_385uc') {
              messageText = '385 UC nibo';
            } else if (payload === 'btn_catalog') {
              messageText = 'UC price list koto';
            } else if (payload === 'btn_website') {
              messageText = 'Website discount link den';
            } else {
              messageText = text || payload;
            }
          }

          console.log(`💬 [WhatsApp Inbound Message] From: ${formattedPhone} (${customerName}) | Text: "${messageText}" | Type: ${message.type} | MessageID: ${message.id}`);

          try {
            // 0. Trigger Seen (Blue Ticks) & Typing Effect on WhatsApp immediately
            if (message.id) {
              whatsappService.markAsReadAndType(message.id).catch(err => {
                console.warn(`⚠️ [WhatsApp Seen/Typing Indicator Error for ${message.id}]:`, err);
              });
            }

            if (!messageText) {
              console.log(`⚠️ [WhatsApp Inbound] Non-text message type received: ${message.type}`);
              continue;
            }

            // 1. Get or create customer profile
            const user = await db.getOrCreateUser(formattedPhone, customerName);

            // 2. Get or create persistent conversation for this customer phone
            const conversation = await db.getOrCreateConversation(formattedPhone, customerName);

            // 3. Save incoming customer message to database
            await db.addMessage(conversation.id, 'CUSTOMER', messageText);
            console.log(`💾 [WhatsApp Saved to DB] Conversation ID: ${conversation.id} | User ID: ${user.id} | Phone: ${formattedPhone}`);

            // 4. If AI is active for this conversation, process via LangChain
            const isAiActive = conversation.is_ai_active !== false;
            if (isAiActive) {
              console.log(`🤖 [WhatsApp AI] Triggering LangChain Agent for ${formattedPhone}...`);
              const response = await langChainAgent.processStructuredMessage({
                phone: formattedPhone,
                messageText,
                conversationId: conversation.id
              });

              console.log(`🤖 [WhatsApp AI Response Generated]: "${response.text}"`);

              // Save Bot message to DB
              await db.addMessage(conversation.id, 'BOT', response.text);

              // Send reply back to customer's WhatsApp (with interactive buttons or text)
              let sendResult;
              if (response.buttons && response.buttons.length > 0) {
                console.log(`🚀 [WhatsApp Outbound] Sending interactive reply with ${response.buttons.length} buttons to ${formattedPhone}...`);
                sendResult = await whatsappService.sendInteractiveButtons(formattedPhone, response.text, response.buttons);
              } else {
                console.log(`🚀 [WhatsApp Outbound] Sending text reply to ${formattedPhone}...`);
                sendResult = await whatsappService.sendMessage(formattedPhone, response.text);
              }

              console.log(`✅ [WhatsApp Outbound Result] for ${formattedPhone}:`, JSON.stringify(sendResult));
            } else {
              console.log(`⏸️ [WhatsApp AI] AI is paused/disabled for conversation ${conversation.id}`);
            }
          } finally {
            if (message.id) {
              releaseInFlight(message.id);
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('❌ [WhatsApp Webhook Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
