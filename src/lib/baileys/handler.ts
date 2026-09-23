import { proto } from '@whiskeysockets/baileys';
import { db } from '../db';
import { stateBot } from '../chat/state-bot';
import { baileysManager } from './client';

const processedMsgIds = new Map<string, number>();
const INFLIGHT_CACHE_TTL_MS = 5 * 60 * 1000;

function isDuplicate(id: string): boolean {
  if (!id) return false;
  const now = Date.now();
  for (const [key, timestamp] of processedMsgIds.entries()) {
    if (now - timestamp > INFLIGHT_CACHE_TTL_MS) processedMsgIds.delete(key);
  }
  if (processedMsgIds.has(id)) return true;
  processedMsgIds.set(id, now);
  return false;
}

export interface ExtractedBaileysMessage {
  text: string;
  buttonId?: string;
  listId?: string;
}

export function extractMessageContent(msg: proto.IWebMessageInfo): ExtractedBaileysMessage {
  const m = msg.message;
  if (!m) return { text: '' };

  let text = '';
  let buttonId: string | undefined = undefined;
  let listId: string | undefined = undefined;

  // 1. Plain text
  if (m.conversation) {
    text = m.conversation.trim();
  }
  // 2. Extended text (e.g. formatted text or reply)
  else if (m.extendedTextMessage?.text) {
    text = m.extendedTextMessage.text.trim();
  }
  // 3. Modern Native Flow button responses
  else if (m.interactiveResponseMessage) {
    const nativeReply = m.interactiveResponseMessage.nativeFlowResponseMessage;
    if (nativeReply?.paramsJson) {
      try {
        const parsed = JSON.parse(nativeReply.paramsJson);
        buttonId = parsed.id || parsed.button_id || parsed.selected_id;
        text = parsed.display_text || parsed.title || buttonId || '';
      } catch {
        buttonId = nativeReply.paramsJson;
        text = buttonId;
      }
    }
  }
  // 4. Classic button response
  else if (m.buttonsResponseMessage) {
    buttonId = m.buttonsResponseMessage.selectedButtonId || undefined;
    text = m.buttonsResponseMessage.selectedDisplayText || buttonId || '';
  }
  // 5. Template button reply
  else if (m.templateButtonReplyMessage) {
    buttonId = m.templateButtonReplyMessage.selectedId || undefined;
    text = m.templateButtonReplyMessage.selectedDisplayText || buttonId || '';
  }
  // 6. List menu response
  else if (m.listResponseMessage) {
    listId = m.listResponseMessage.singleSelectReply?.selectedRowId || undefined;
    buttonId = listId;
    text = m.listResponseMessage.title || listId || '';
  }
  // 7. Image caption
  else if (m.imageMessage?.caption) {
    text = m.imageMessage.caption.trim();
  }

  return { text, buttonId, listId };
}

/**
 * Handle incoming Baileys messages and dispatch to stateBot
 */
export async function handleBaileysIncomingMessage(msg: proto.IWebMessageInfo): Promise<void> {
  const messageId = msg.key?.id;
  if (!messageId || isDuplicate(messageId)) {
    return;
  }

  const remoteJid = msg.key?.remoteJid;
  if (!remoteJid) return;

  // Only handle private chats (ignore status broadcast or groups if desired)
  if (remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') {
    return;
  }

  // Remember the exact JID (PN or LID — see https://baileys.wiki/concepts/jids)
  // this contact messaged us from, so every reply below targets the correct
  // address. Without this, replies to @lid senders are built as a guessed
  // "@s.whatsapp.net" JID that doesn't exist — the send reports success
  // (relay accepted) but the customer never receives anything.
  baileysManager.rememberContactJid(remoteJid);

  const rawPhone = remoteJid.split('@')[0];
  const formattedPhone = rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`;
  const customerName = msg.pushName || 'Customer';

  const { text, buttonId, listId } = extractMessageContent(msg);

  if (!text && !buttonId && !listId) {
    return;
  }

  console.log(`[Baileys Inbound] from=${formattedPhone} (${customerName}) text="${text}" buttonId="${buttonId}" listId="${listId}"`);

  try {
    // 1. Persist user & conversation
    const user = await db.getOrCreateUser(formattedPhone, customerName);
    const conversation = await db.getOrCreateConversation(formattedPhone, customerName);
    await db.addMessage(conversation.id, 'CUSTOMER', text || buttonId || listId || '');

    // 2. Dispatch to State Bot engine
    // Bounded so a stuck downstream call (WhatsApp send, DB, payment gateway) always
    // surfaces as a loggable timeout instead of silently hanging the customer forever.
    const DISPATCH_TIMEOUT_MS = 30_000;
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([
      stateBot.handleIncomingMessage({
        conversationId: conversation.id,
        userId: user.id,
        phone: formattedPhone,
        customerName,
        text,
        buttonId,
        listId
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`stateBot dispatch timed out after ${DISPATCH_TIMEOUT_MS}ms`)),
          DISPATCH_TIMEOUT_MS
        );
      })
    ]).finally(() => {
      if (timer) clearTimeout(timer);
    });

    console.log(`[Baileys Inbound] ✅ Dispatch complete for ${formattedPhone}`);
  } catch (err) {
    console.error(`[Baileys Inbound Dispatch Error] from=${remoteJid}:`, err);
  }
}
