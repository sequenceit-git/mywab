import { env } from '../config/env';
import { sanitizeReplyMarkup } from './card-builder';

export const telegramClient = {
  async answerCallbackQuery(callbackQueryId: string, text: string, showAlert = false): Promise<boolean> {
    if (!env.telegram.isConfigured) return false;
    try {
      const response = await fetch(`${env.telegram.apiUrl}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text,
          show_alert: showAlert
        })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        console.error('[Telegram answerCallbackQuery Error]:', response.status, data);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Error answering callback query:', e);
      return false;
    }
  },

  async deleteMessage(chatId: string | number, messageId: number): Promise<boolean> {
    if (!env.telegram.isConfigured) return false;
    try {
      const response = await fetch(`${env.telegram.apiUrl}/deleteMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId
        })
      });
      const data = await response.json();
      return Boolean(data.ok);
    } catch (e) {
      console.error('Error deleting telegram message:', e);
      return false;
    }
  },

  async editMessageReplyMarkup(chatId: string | number, messageId: number, replyMarkup?: unknown): Promise<boolean> {
    if (!env.telegram.isConfigured) return false;
    try {
      const sanitizedMarkup = sanitizeReplyMarkup(replyMarkup);
      const response = await fetch(`${env.telegram.apiUrl}/editMessageReplyMarkup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          reply_markup: sanitizedMarkup
        })
      });
      const data = await response.json().catch(() => null);
      return Boolean(response.ok && data?.ok);
    } catch (e) {
      console.error('Error editing message reply markup:', e);
      return false;
    }
  },

  async editMessageText(chatId: string | number, messageId: number, text: string, replyMarkup?: unknown): Promise<boolean> {
    if (!env.telegram.isConfigured) return false;
    try {
      const sanitizedMarkup = sanitizeReplyMarkup(replyMarkup);
      const response = await fetch(`${env.telegram.apiUrl}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: 'HTML',
          reply_markup: sanitizedMarkup
        })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        console.error('[Telegram editMessageText Error]:', response.status, data);
        if (data?.description?.includes("can't parse entities")) {
          console.warn('[Telegram editMessageText] Retrying without parse_mode HTML...');
          const plainText = text.replace(/<[^>]*>/g, '');
          const retryRes = await fetch(`${env.telegram.apiUrl}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: plainText,
              reply_markup: sanitizedMarkup
            })
          });
          const retryData = await retryRes.json().catch(() => null);
          return Boolean(retryRes.ok && retryData?.ok);
        }
        return false;
      }
      return true;
    } catch (e) {
      console.error('Error editing message text:', e);
      return false;
    }
  },

  async sendMessage(
    chatId: string | number,
    text: string,
    options?: {
      parse_mode?: string;
      reply_markup?: unknown;
      reply_to_message_id?: number;
    }
  ): Promise<{ ok: boolean; result?: { message_id: number } }> {
    if (!env.telegram.isConfigured) return { ok: false };
    try {
      const sanitizedMarkup = sanitizeReplyMarkup(options?.reply_markup);
      const response = await fetch(`${env.telegram.apiUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: options?.parse_mode || 'HTML',
          reply_markup: sanitizedMarkup,
          reply_to_message_id: options?.reply_to_message_id
        })
      });
      const data = await response.json().catch(() => ({ ok: false }));
      if (!response.ok || !data.ok) {
        console.error('[Telegram sendMessage Error]:', response.status, data);
      }
      return { ok: Boolean(data.ok), result: data.result };
    } catch (e) {
      console.error('Error sending telegram message:', e);
      return { ok: false };
    }
  }
};
