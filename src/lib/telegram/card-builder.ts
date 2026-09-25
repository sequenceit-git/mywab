import { Order } from '@/types';
import { getAccountFieldInfo, formatPaymentDisplayForTelegram } from '../chat/input-parser';

export interface PendingWorkerCancellation {
  orderIdCode: string;
  workerTelegramId: number;
  workerName: string;
  chatId?: string | number;
  messageId?: number;
  createdAt: number;
}

// In-memory store for tracking active worker cancellation prompt sessions
const pendingWorkerCancellations = new Map<number, PendingWorkerCancellation>();

export const cancellationStore = {
  setPendingCancellation(workerTelegramId: number, data: Omit<PendingWorkerCancellation, 'createdAt'>) {
    pendingWorkerCancellations.set(workerTelegramId, { ...data, createdAt: Date.now() });
  },

  getPendingCancellation(workerTelegramId: number): PendingWorkerCancellation | undefined {
    const pending = pendingWorkerCancellations.get(workerTelegramId);
    if (!pending) return undefined;
    // Expire after 15 minutes
    if (Date.now() - pending.createdAt > 15 * 60 * 1000) {
      pendingWorkerCancellations.delete(workerTelegramId);
      return undefined;
    }
    return pending;
  },

  clearPendingCancellation(workerTelegramId: number) {
    pendingWorkerCancellations.delete(workerTelegramId);
  }
};

/**
 * Resolve predefined cancellation reason codes to user-facing Bengali + English strings
 */
export function resolveCancelReason(
  reasonCodeOrText: string,
  order?: { items?: Array<{ product_name?: string }>; player_uid?: string; delivery_address?: any }
): string {
  if (!reasonCodeOrText) return 'Worker cancelled';

  if (reasonCodeOrText === 'invalid_info') {
    const firstItem = order?.items?.[0];
    const prodName = firstItem?.product_name || '';
    const playerUid = 
      order?.player_uid || 
      (order?.delivery_address as any)?.player_uid || 
      (order?.delivery_address as any)?.name ||
      order?.delivery_address?.address?.match(/(?:UID|Player UID|Email|Gmail|Account|ID):\s*([0-9a-zA-Z@._+-]+)/i)?.[1] ||
      'N/A';
    const accountInfo = getAccountFieldInfo(playerUid, prodName);
    return `Invalid ${accountInfo.labelEn} (ভুল তথ্য)`;
  }

  if (reasonCodeOrText === 'fake_trxid') {
    return 'Fake or Invalid TrxID (পেমেন্ট মেলেনি)';
  }

  if (reasonCodeOrText === 'refund_needed') {
    return 'Refund Needed (অটো-পেইড অর্ডার / গ্রাহককে রিফান্ড প্রযোজ্য)';
  }

  if (reasonCodeOrText === 'stock_out') {
    return 'Out of Stock / Server Error (স্টক শেষ)';
  }

  if (reasonCodeOrText === 'customer_req') {
    return 'Customer Requested (গ্রাহকের অনুরোধ)';
  }

  return reasonCodeOrText;
}

/**
 * Ensure no inline keyboard button callback_data exceeds Telegram's 64-byte UTF-8 limit.
 * If any button exceeds 64 bytes, it is safely sliced so Telegram API never throws BUTTON_DATA_INVALID.
 */
export function sanitizeReplyMarkup(markup?: any): any {
  if (!markup || !markup.inline_keyboard || !Array.isArray(markup.inline_keyboard)) return markup;
  const newKeyboard = markup.inline_keyboard.map((row: any[]) =>
    Array.isArray(row)
      ? row.map((btn: any) => {
          if (btn && typeof btn.callback_data === 'string' && Buffer.byteLength(btn.callback_data, 'utf8') > 64) {
            console.error(`[Telegram Warning] Button callback_data exceeds 64 bytes (${Buffer.byteLength(btn.callback_data, 'utf8')}b): "${btn.callback_data}"`);
            let truncated = btn.callback_data;
            while (Buffer.byteLength(truncated, 'utf8') > 64) {
              truncated = truncated.slice(0, -1);
            }
            return { ...btn, callback_data: truncated };
          }
          return btn;
        })
      : row
  );
  return { ...markup, inline_keyboard: newKeyboard };
}

/**
 * Detect whether an order is a PUBG QR Login Order
 */
export function isQrLoginOrder(order: { customer_notes?: string; items?: Array<{ product_name?: string }> }): boolean {
  const firstItem = order.items?.[0];
  const gameTitle = 
    order.customer_notes?.match(/Game:\s*([^|\n]+)/i)?.[1]?.trim() || 
    firstItem?.product_name || 
    '';
  const combined = `${gameTitle} ${firstItem?.product_name || ''} ${order.customer_notes || ''}`.toLowerCase();
  
  // Code Method games (PUBG KR, eFootball) must not be treated as QR login
  if (
    combined.includes('pubg_kr') ||
    combined.includes('korean') ||
    combined.includes('kr uc') ||
    combined.includes('efootball') ||
    combined.includes('efb') ||
    combined.includes('konami')
  ) {
    return false;
  }

  return (
    combined.includes('qr') || 
    combined.includes('pubg_login') ||
    combined.includes('login uc')
  );
}

/**
 * Detect whether the worker has already provided/sent the QR screenshot to the customer
 */
export function hasQrCodeBeenSent(order: { customer_notes?: string; status?: string }): boolean {
  const notes = order.customer_notes || '';
  const lastForwardIdx = notes.lastIndexOf('QR Code forwarded');
  const lastRefreshIdx = notes.lastIndexOf('QR_REFRESH_REQUESTED');
  if (lastRefreshIdx !== -1 && lastRefreshIdx > lastForwardIdx) {
    return false;
  }
  return (
    notes.includes('QR Code forwarded') ||
    notes.includes('Storage:') ||
    notes.includes('Customer Scanned') ||
    notes.includes('QR_SCANNED') ||
    order.status === 'PROCESSING' ||
    order.status === 'DELIVERED'
  );
}

/**
 * Helper to build dynamic HTML card and inline keyboard for any order state
 */
export function generateOrderCard(
  order: Order,
  assignedWorkerName?: string,
  queueCount?: number
): { cardHtml: string; replyMarkup: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> } } {
  const firstItem = order.items?.[0];
  const itemsText = order.items
    ?.map(item => `  ▪️ <b>${item.product_name}</b> x ${item.quantity} = ৳${item.subtotal}`)
    .join('\n') || '  ▪️ No item details';

  const gameTitle = 
    order.customer_notes?.match(/Game:\s*([^|\n]+)/i)?.[1]?.trim() || 
    firstItem?.product_name || 
    'Top-Up Service';

  const workerName = assignedWorkerName || order.current_worker?.full_name || 'Worker Assigned';

  const playerUid = 
    order.player_uid || 
    (order.delivery_address as any)?.player_uid || 
    (order.delivery_address as any)?.name ||
    order.delivery_address?.address?.match(/(?:UID|Player UID|Email|ID):\s*([0-9a-zA-Z@._+-]+)/i)?.[1] ||
    order.customer_notes?.match(/(?:PUBG UID|UID|Player UID|Email|Account):\s*([0-9a-zA-Z@._+-]+)/i)?.[1] ||
    'N/A';

  const password = 
    order.customer_notes?.match(/Password:\s*([^|\n]+)/i)?.[1]?.trim() || 
    (order.delivery_address as any)?.password || 
    '';
  const passwordLine = password ? `\n🔐 <b>Password:</b> <code>${password}</code>` : '';

  const trxId = 
    order.trx_id || 
    (order.delivery_address as any)?.trx_id ||
    (order.delivery_address as any)?.notes ||
    order.customer_notes?.match(/(?:Proof|Trx):\s*([^|\n]+)/i)?.[1]?.trim() ||
    order.payments?.[0]?.transaction_id ||
    (order.payments?.[0] as any)?.trx_id ||
    'N/A';

  const paymentMethod = 
    order.payment_method || 
    (order.delivery_address as any)?.payment_method || 
    order.customer_notes?.match(/Pay:\s*([^|\n]+)/i)?.[1]?.trim() ||
    (order.payments?.[0] as any)?.payment_method ||
    order.payments?.[0]?.method ||
    'bKash/Nagad/Rocket';

  const invoiceId = 
    order.invoice_id || 
    (order.delivery_address as any)?.invoice_id || 
    order.customer_notes?.match(/Invoice:\s*([a-zA-Z0-9_-]+)/i)?.[1] || 
    '';

  const accountInfo = getAccountFieldInfo(playerUid, gameTitle);
  const { methodLabel, proofLines, isAutoVerified } = formatPaymentDisplayForTelegram(trxId, paymentMethod, invoiceId);

  const isQrOrder = isQrLoginOrder(order);
  const qrBanner = isQrOrder ? `\n📲 <b>[PUBG QR LOGIN ORDER]</b>\n` : '';
  const hasQrSent = hasQrCodeBeenSent(order);
  const hasQrScanned = (order.customer_notes || '').includes('Customer Scanned') || (order.customer_notes || '').includes('QR_SCANNED');

  // Email Verification "Code Method" orders (PUBG KR + eFootball Android/iOS only)
  const combinedGameStr = `${gameTitle} ${firstItem?.product_name || ''} ${order.customer_notes || ''}`.toLowerCase();
  const isCodeOrder =
    combinedGameStr.includes('korean') ||
    combinedGameStr.includes('pubg_kr') ||
    combinedGameStr.includes('kr uc') ||
    combinedGameStr.includes('efootball') ||
    combinedGameStr.includes('efb') ||
    combinedGameStr.includes('konami');

  const codeBanner = isCodeOrder ? `\n📧 <b>[EMAIL CODE VERIFICATION ORDER]</b>\n` : '';
  const codeNotes = order.customer_notes || '';
  const lastCodeRequestIdx = codeNotes.lastIndexOf('CODE_REQUESTED');
  const lastCodeReceivedIdx = codeNotes.lastIndexOf('CODE_RECEIVED:');
  const hasCodeRequested = lastCodeRequestIdx !== -1;
  const hasCodeReceived = lastCodeReceivedIdx !== -1 && lastCodeReceivedIdx > lastCodeRequestIdx;
  const receivedCode = hasCodeReceived
    ? (codeNotes.slice(lastCodeReceivedIdx).match(/CODE_RECEIVED:\s*([^|]+)/i)?.[1] || '').trim()
    : '';

  const rawNotes = (order.customer_notes || '').trim();
  const isInternalBotNote = 
    rawNotes.startsWith('State Bot Order') || 
    rawNotes.startsWith('Payment Verified') || 
    rawNotes.startsWith('Kokos Auto') ||
    rawNotes.startsWith('Pinex Auto') ||
    rawNotes.startsWith('QR Code forwarded') ||
    rawNotes === 'None';
  const customNotesLine = (!isInternalBotNote && rawNotes) ? `\n📝 <b>Notes:</b> ${rawNotes}` : '';

  // Netflix Account Order Detection
  const isNetflix = combinedGameStr.includes('netflix');
  const netflixBanner = isNetflix ? `\n🍿 <b>[NETFLIX ACCOUNT ORDER]</b>\n` : '';
  const netflixNotes = order.customer_notes || '';
  const hasNetflixCredsSent = netflixNotes.includes('NETFLIX_CREDS_SENT');
  const lastNetflixCodeReqIdx = netflixNotes.lastIndexOf('NETFLIX_CODE_REQUESTED');
  const lastNetflixCodeSentIdx = netflixNotes.lastIndexOf('NETFLIX_CODE_SENT');
  const hasNetflixCodeRequested = lastNetflixCodeReqIdx !== -1 && (lastNetflixCodeSentIdx === -1 || lastNetflixCodeReqIdx > lastNetflixCodeSentIdx);
  const hasNetflixLoginDone = netflixNotes.includes('NETFLIX_LOGIN_DONE');

  // YouTube Premium Order Detection
  const isYouTube = combinedGameStr.includes('youtube');
  const youtubeBanner = isYouTube ? `\n▶️ <b>[YOUTUBE PREMIUM SUBSCRIPTION]</b>\n` : '';

  // Crunchyroll Account Order Detection
  const isCrunchyroll = combinedGameStr.includes('crunchyroll');
  const crunchyrollBanner = isCrunchyroll ? `\n🍥 <b>[CRUNCHYROLL ACCOUNT ORDER]</b>\n` : '';
  const crunchyrollNotes = order.customer_notes || '';
  const hasCrunchyrollCredsSent = crunchyrollNotes.includes('CRUNCHYROLL_CREDS_SENT');
  const hasCrunchyrollLoginDone = crunchyrollNotes.includes('CRUNCHYROLL_LOGIN_DONE');
  const crunchyrollCredEmail = crunchyrollNotes.match(/Email:\s*([^\s|]+)/i)?.[1] || '';
  const crunchyrollCredPass = crunchyrollNotes.match(/Pass:\s*([^\s|]+)/i)?.[1] || '';

  const netflixCredEmail = netflixNotes.match(/Email:\s*([^\s|]+)/i)?.[1] || '';
  const netflixCredPass = netflixNotes.match(/Pass:\s*([^\s|]+)/i)?.[1] || '';
  const netflixCredPin = netflixNotes.match(/PIN:\s*([^\s|]+)/i)?.[1] || '';
  const netflixCodeSent = netflixNotes.match(/NETFLIX_CODE_SENT:\s*([^\s|]+)/i)?.[1] || '';

  if (order.status === 'CLAIMED' || order.status === 'PROCESSING') {
    if (isCrunchyroll) {
      if (hasCrunchyrollLoginDone) {
        return {
          cardHtml: 
`🎉 <b>CUSTOMER CONFIRMED CRUNCHYROLL LOGIN! / গ্রাহক লগইন সম্পন্ন করেছেন</b>${crunchyrollBanner}
📦 <b>Order ID:</b> <code>${order.order_id}</code>
👷 <b>Assigned Worker:</b> <b>${workerName}</b>
💰 <b>Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>${proofLines ? `\n${proofLines}` : ''}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>${customNotesLine}

🍥 <b>Service / Game:</b> <b>${gameTitle}</b>
${crunchyrollCredEmail ? `📧 <b>Email:</b> <code>${crunchyrollCredEmail}</code>\n` : ''}${crunchyrollCredPass ? `🔐 <b>Password:</b> <code>${crunchyrollCredPass}</code>\n` : ''}
💎 <b>Packages:</b>
${itemsText}

✅ <b>কাস্টমার নিশ্চিত করেছেন যে তার Crunchyroll লগইন সফল হয়েছে!</b>
এখন নিচের <b>"✅ Order Completed"</b> বাটনে চাপ দিয়ে ডেলিভারি সম্পন্ন করুন।`,
          replyMarkup: {
            inline_keyboard: [
              [
                { text: '✅ Order Completed (ডেলিভারি সম্পন্ন)', callback_data: `status_delivered:${order.order_id}` }
              ],
              [
                { text: '❌ Cancel Order (বাতিল করুন)', callback_data: `cancel_prompt:${order.order_id}` }
              ]
            ]
          }
        };
      } else if (hasCrunchyrollCredsSent) {
        return {
          cardHtml: 
`📤 <b>CRUNCHYROLL CREDENTIALS DELIVERED / অ্যাকাউন্ট পাঠানো হয়েছে</b>${crunchyrollBanner}
📦 <b>Order ID:</b> <code>${order.order_id}</code>
👷 <b>Assigned Worker:</b> <b>${workerName}</b>
💰 <b>Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>${proofLines ? `\n${proofLines}` : ''}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>${customNotesLine}

🍥 <b>Service / Game:</b> <b>${gameTitle}</b>
${crunchyrollCredEmail ? `📧 <b>Email:</b> <code>${crunchyrollCredEmail}</code>\n` : ''}${crunchyrollCredPass ? `🔐 <b>Password:</b> <code>${crunchyrollCredPass}</code>\n` : ''}
💎 <b>Packages:</b>
${itemsText}

✅ <b>কাস্টমারের WhatsApp-এ Crunchyroll অ্যাকাউন্ট (Email, Pass) পাঠানো হয়েছে।</b>
<i>কাস্টমার লগইন সম্পন্ন করার পর কনফার্ম করলে এখানে নোটিফিকেশন আসবে।</i>`,
          replyMarkup: {
            inline_keyboard: [
              [
                { text: '🔑 Resend Account Info', callback_data: `crunchyroll_creds_hint:${order.order_id}` },
                { text: '✅ Order Completed', callback_data: `status_delivered:${order.order_id}` }
              ],
              [
                { text: '❌ Cancel Order (বাতিল করুন)', callback_data: `cancel_prompt:${order.order_id}` }
              ]
            ]
          }
        };
      } else {
        return {
          cardHtml: 
`🍥 <b>CRUNCHYROLL ORDER CLAIMED — SEND ACCOUNT INFO / তথ্য দিন</b>${crunchyrollBanner}
📦 <b>Order ID:</b> <code>${order.order_id}</code>
👷 <b>Assigned Worker:</b> <b>${workerName}</b>
💰 <b>Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>${proofLines ? `\n${proofLines}` : ''}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>${customNotesLine}

🍥 <b>Service / Game:</b> <b>${gameTitle}</b>

💎 <b>Packages:</b>
${itemsText}

🔑 <b>ACTION REQUIRED:</b>
অনুগ্রহ করে এই মেসেজে রিপ্লাই করে কাস্টমারের জন্য <b>Crunchyroll Email ও Password</b> পাঠান।
<i>উদাহরণ:</i>
<code>user@crunchyroll.com
pass123</code>`,
          replyMarkup: {
            inline_keyboard: [
              [
                { text: '🔑 Send Account Info (তথ্য দিন)', callback_data: `crunchyroll_creds_hint:${order.order_id}` }
              ],
              [
                { text: '❌ Cancel Order (বাতিল করুন)', callback_data: `cancel_prompt:${order.order_id}` }
              ]
            ]
          }
        };
      }
    }
    if (isYouTube) {
      return {
        cardHtml: 
`▶️ <b>ORDER CLAIMED [AUTO-PAID] / অর্ডার গ্রহণ করা হয়েছে</b>${youtubeBanner}
📦 <b>Order ID:</b> <code>${order.order_id}</code>
👷 <b>Assigned Worker:</b> <b>${workerName}</b>
💰 <b>Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>${proofLines ? `\n${proofLines}` : ''}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>${customNotesLine}

🕹️ <b>Service / Game:</b> <b>${gameTitle}</b>
📧 <b>YouTube Email:</b> <code>${playerUid}</code>

💎 <b>Packages:</b>
${itemsText}

👉 <b>অ্যাকশন:</b> কাস্টমারের ইমেইলে (<code>${playerUid}</code>) YouTube Premium ফ্যামিলি ইনভাইটেশন পাঠিয়ে নিচের <b>"✅ Order Completed"</b> বাটনে চাপ দিন।`,
        replyMarkup: {
          inline_keyboard: [
            [
              { text: '✅ Order Completed (ডেলিভারি সম্পন্ন)', callback_data: `status_delivered:${order.order_id}` }
            ],
            [
              { text: '❌ Cancel Order (বাতিল করুন)', callback_data: `cancel_prompt:${order.order_id}` }
            ]
          ]
        }
      };
    }

    if (isNetflix) {
      if (hasNetflixLoginDone) {
        return {
          cardHtml: 
`🎉 <b>CUSTOMER CONFIRMED NETFLIX LOGIN! / গ্রাহক লগইন সম্পন্ন করেছেন</b>${netflixBanner}
📦 <b>Order ID:</b> <code>${order.order_id}</code>
👷 <b>Assigned Worker:</b> <b>${workerName}</b>
💰 <b>Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>${proofLines ? `\n${proofLines}` : ''}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>${customNotesLine}

🍿 <b>Service / Game:</b> <b>${gameTitle}</b>
${netflixCredEmail ? `📧 <b>Email:</b> <code>${netflixCredEmail}</code>\n` : ''}${netflixCredPass ? `🔐 <b>Password:</b> <code>${netflixCredPass}</code>\n` : ''}${netflixCredPin ? `📌 <b>PIN:</b> <code>${netflixCredPin}</code>\n` : ''}${netflixCodeSent ? `🔑 <b>Verification Code:</b> <code>${netflixCodeSent}</code>\n` : ''}
💎 <b>Packages:</b>
${itemsText}

✅ <b>কাস্টমার নিশ্চিত করেছেন যে তার Netflix লগইন সফল হয়েছে!</b>
এখন নিচের <b>"✅ Order Completed"</b> বাটনে চাপ দিয়ে ডেলিভারি সম্পন্ন করুন।`,
          replyMarkup: {
            inline_keyboard: [
              [
                { text: '✅ Order Completed (ডেলিভারি সম্পন্ন)', callback_data: `status_delivered:${order.order_id}` }
              ],
              [
                { text: '❌ Cancel Order (বাতিল করুন)', callback_data: `cancel_prompt:${order.order_id}` }
              ]
            ]
          }
        };
      } else if (hasNetflixCodeRequested) {
        return {
          cardHtml: 
`🔔 <b>CUSTOMER REQUESTED NETFLIX CODE! / কোড চেয়েছেন</b>${netflixBanner}
📦 <b>Order ID:</b> <code>${order.order_id}</code>
👷 <b>Assigned Worker:</b> <b>${workerName}</b>
💰 <b>Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>${proofLines ? `\n${proofLines}` : ''}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>${customNotesLine}

🍿 <b>Service / Game:</b> <b>${gameTitle}</b>
${netflixCredEmail ? `📧 <b>Email:</b> <code>${netflixCredEmail}</code>\n` : ''}${netflixCredPass ? `🔐 <b>Password:</b> <code>${netflixCredPass}</code>\n` : ''}${netflixCredPin ? `📌 <b>PIN:</b> <code>${netflixCredPin}</code>\n` : ''}
💎 <b>Packages:</b>
${itemsText}

⏳ <b>কাস্টমার Netflix ভেরিফিকেশন কোড চেয়েছেন!</b>
👉 আপনার Netflix ইমেইল/ওটিপি দেখে এই মেসেজে রিপ্লাই করে কোডটি পাঠান (যেমন: <code>482910</code>)।`,
          replyMarkup: {
            inline_keyboard: [
              [
                { text: '📤 Send Code to Customer', callback_data: `netflix_code_hint:${order.order_id}` }
              ],
              [
                { text: '✅ Order Completed', callback_data: `status_delivered:${order.order_id}` }
              ],
              [
                { text: '❌ Cancel Order (বাতিল করুন)', callback_data: `cancel_prompt:${order.order_id}` }
              ]
            ]
          }
        };
      } else if (hasNetflixCredsSent) {
        return {
          cardHtml: 
`📤 <b>NETFLIX CREDENTIALS DELIVERED / অ্যাকাউন্ট পাঠানো হয়েছে</b>${netflixBanner}
📦 <b>Order ID:</b> <code>${order.order_id}</code>
👷 <b>Assigned Worker:</b> <b>${workerName}</b>
💰 <b>Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>${proofLines ? `\n${proofLines}` : ''}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>${customNotesLine}

🍿 <b>Service / Game:</b> <b>${gameTitle}</b>
${netflixCredEmail ? `📧 <b>Email:</b> <code>${netflixCredEmail}</code>\n` : ''}${netflixCredPass ? `🔐 <b>Password:</b> <code>${netflixCredPass}</code>\n` : ''}${netflixCredPin ? `📌 <b>PIN:</b> <code>${netflixCredPin}</code>\n` : ''}${netflixCodeSent ? `🔑 <b>Verification Code:</b> <code>${netflixCodeSent}</code>\n` : ''}
💎 <b>Packages:</b>
${itemsText}

✅ <b>কাস্টমারের WhatsApp-এ Netflix অ্যাকাউন্ট (Email, Pass, Pin) পাঠানো হয়েছে।</b>
<i>কাস্টমার ডিভাইসে লগইন করার পর কোড চাইলে এখানে নোটিফিকেশন আসবে।</i>`,
          replyMarkup: {
            inline_keyboard: [
              [
                { text: '🔑 Resend Account Info', callback_data: `netflix_creds_hint:${order.order_id}` },
                { text: '📤 Send Code Directly', callback_data: `netflix_code_hint:${order.order_id}` }
              ],
              [
                { text: '✅ Order Completed', callback_data: `status_delivered:${order.order_id}` }
              ],
              [
                { text: '❌ Cancel Order (বাতিল করুন)', callback_data: `cancel_prompt:${order.order_id}` }
              ]
            ]
          }
        };
      } else {
        return {
          cardHtml: 
`🍿 <b>NETFLIX ORDER CLAIMED — SEND ACCOUNT INFO / তথ্য দিন</b>${netflixBanner}
📦 <b>Order ID:</b> <code>${order.order_id}</code>
👷 <b>Assigned Worker:</b> <b>${workerName}</b>
💰 <b>Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>${proofLines ? `\n${proofLines}` : ''}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>${customNotesLine}

🍿 <b>Service / Game:</b> <b>${gameTitle}</b>

💎 <b>Packages:</b>
${itemsText}

🔑 <b>ACTION REQUIRED:</b>
অনুগ্রহ করে এই মেসেজে রিপ্লাই করে কাস্টমারের জন্য <b>Netflix Email, Password ও PIN</b> পাঠান।
<i>উদাহরণ:</i>
<code>user@netflix.com
pass123
1234</code>`,
          replyMarkup: {
            inline_keyboard: [
              [
                { text: '🔑 Send Account Info (তথ্য দিন)', callback_data: `netflix_creds_hint:${order.order_id}` }
              ],
              [
                { text: '❌ Cancel Order (বাতিল করুন)', callback_data: `cancel_prompt:${order.order_id}` }
              ]
            ]
          }
        };
      }
    }

    if (isQrOrder) {
      if (hasQrScanned) {
        // Stage 3: Customer Scanned QR -> Worker should finish and click Completed
        return {
          cardHtml: 
`🎯 <b>CUSTOMER SCANNED QR! / গ্রাহক স্ক্যান সম্পন্ন করেছেন</b>${qrBanner}
📦 <b>Order ID:</b> <code>${order.order_id}</code>
👷 <b>Assigned Worker:</b> <b>${workerName}</b>
💰 <b>Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>${proofLines ? `\n${proofLines}` : ''}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>${customNotesLine}

🕹️ <b>Service / Game:</b> <b>${gameTitle}</b>
${accountInfo.emoji} <b>${accountInfo.labelEn}:</b> <code>${playerUid}</code>${passwordLine}

💎 <b>Packages:</b>
${itemsText}

✅ <b>গ্রাহক QR কোড স্ক্যান করেছেন!</b>
এখন Midasbuy বা গেমে লগইন করে টপ-আপ সম্পন্ন করুন এবং নিচের <b>"✅ Order Completed"</b> বাটনে চাপ দিন।`,
          replyMarkup: {
            inline_keyboard: [
              [
                { text: '✅ Order Completed (ডেলিভারি সম্পন্ন)', callback_data: `status_delivered:${order.order_id}` }
              ],
              [
                { text: '❌ Cancel Order (বাতিল করুন)', callback_data: `cancel_prompt:${order.order_id}` }
              ]
            ]
          }
        };
      } else if (hasQrSent) {
        // Stage 2: QR Code Sent to WhatsApp -> Waiting for customer scan
        return {
          cardHtml: 
`📤 <b>QR CODE SENT TO WHATSAPP / কিউআর পাঠানো হয়েছে</b>${qrBanner}
📦 <b>Order ID:</b> <code>${order.order_id}</code>
👷 <b>Assigned Worker:</b> <b>${workerName}</b>
💰 <b>Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>${proofLines ? `\n${proofLines}` : ''}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>${customNotesLine}

🕹️ <b>Service / Game:</b> <b>${gameTitle}</b>
${accountInfo.emoji} <b>${accountInfo.labelEn}:</b> <code>${playerUid}</code>${passwordLine}

💎 <b>Packages:</b>
${itemsText}

⏱️ <b>মেয়াদ:</b> ৫ মিনিট কাউন্টডাউন শুরু হয়েছে।
<i>গ্রাহক WhatsApp থেকে স্ক্যান করার পর বা নতুন QR চাইলে সাথে সাথে আপডেট দেখতে পাবেন।</i>`,
          replyMarkup: {
            inline_keyboard: [
              [
                { text: '⏳ Waiting for Scan (স্ক্যানের অপেক্ষায়)', callback_data: `qr_waiting:${order.order_id}` }
              ],
              [
                { text: '🔄 Resend QR (নতুন QR পাঠান)', callback_data: `qr_resend_hint:${order.order_id}` },
                { text: '✅ Order Completed', callback_data: `status_delivered:${order.order_id}` }
              ],
              [
                { text: '❌ Cancel Order (বাতিল করুন)', callback_data: `cancel_prompt:${order.order_id}` }
              ]
            ]
          }
        };
      } else {
        // Stage 1: Claimed, waiting for worker to send QR screenshot
        return {
          cardHtml: 
`✅ <b>ORDER CLAIMED — SEND QR CODE / কিউআর পাঠান</b>${qrBanner}
📦 <b>Order ID:</b> <code>${order.order_id}</code>
👷 <b>Assigned Worker:</b> <b>${workerName}</b>
💰 <b>Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>${proofLines ? `\n${proofLines}` : ''}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>${customNotesLine}

🕹️ <b>Service / Game:</b> <b>${gameTitle}</b>
${accountInfo.emoji} <b>${accountInfo.labelEn}:</b> <code>${playerUid}</code>${passwordLine}

💎 <b>Packages:</b>
${itemsText}

📸 <b>ACTION REQUIRED:</b>
অনুগ্রহ করে এই মেসেজে রিপ্লাই করে <b>Login QR কোডের স্ক্রিনশট/ছবি</b> পাঠান। বট সাথে সাথে কাস্টমারের WhatsApp-এ পাঠিয়ে দেবে (৫ মিনিট মেয়াদ)।`,
          replyMarkup: {
            inline_keyboard: [
              [
                { text: '📸 Send QR Screenshot (ছবি পাঠান)', callback_data: `qr_hint:${order.order_id}` }
              ],
              [
                { text: '❌ Cancel Order (বাতিল করুন)', callback_data: `cancel_prompt:${order.order_id}` }
              ]
            ]
          }
        };
      }
    } else if (isCodeOrder) {
      if (hasCodeReceived) {
        // Stage 3: Customer sent the code -> Worker verifies it on the site
        return {
          cardHtml:
`🔑 <b>CODE RECEIVED FROM CUSTOMER! / কাস্টমার কোড পাঠিয়েছেন</b>${codeBanner}
📦 <b>Order ID:</b> <code>${order.order_id}</code>
👷 <b>Assigned Worker:</b> <b>${workerName}</b>
💰 <b>Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>${proofLines ? `\n${proofLines}` : ''}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>${customNotesLine}

🕹️ <b>Service / Game:</b> <b>${gameTitle}</b>
${accountInfo.emoji} <b>${accountInfo.labelEn}:</b> <code>${playerUid}</code>${passwordLine}
🔑 <b>Verification Code:</b> <code>${receivedCode || 'N/A'}</code>

💎 <b>Packages:</b>
${itemsText}

✅ <b>কাস্টমার কোড পাঠিয়েছে!</b> কোডটি দিয়ে সাইটে লগইন/ভেরিফাই করুন। কোড কাজ না করলে নিচে <b>"Code Expired"</b> চাপুন, সফল হলে <b>"Order Completed"</b> চাপুন।`,
          replyMarkup: {
            inline_keyboard: [
              [
                { text: '✅ Order Completed (ডেলিভারী সম্পন্ন)', callback_data: `status_delivered:${order.order_id}` }
              ],
              [
                { text: '🔄 Code Expired / Request New Code', callback_data: `code_request:${order.order_id}` }
              ],
              [
                { text: '❌ Cancel Order (বাতিল করুন)', callback_data: `cancel_prompt:${order.order_id}` }
              ]
            ]
          }
        };
      } else if (hasCodeRequested) {
        // Stage 2: Code requested from customer -> Waiting for customer's reply
        return {
          cardHtml:
`📧 <b>CODE REQUESTED — WAITING FOR CUSTOMER / কোডের অপেক্ষায়</b>${codeBanner}
📦 <b>Order ID:</b> <code>${order.order_id}</code>
👷 <b>Assigned Worker:</b> <b>${workerName}</b>
💰 <b>Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>${proofLines ? `\n${proofLines}` : ''}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>${customNotesLine}

🕹️ <b>Service / Game:</b> <b>${gameTitle}</b>
${accountInfo.emoji} <b>${accountInfo.labelEn}:</b> <code>${playerUid}</code>${passwordLine}

💎 <b>Packages:</b>
${itemsText}

⏳ <i>কাস্টমারকে ইমেইলের কোড পাঠাতে বলা হয়েছে। কাস্টমার কোড পাঠালে সাথে সাথে এখানে আপডেট আসবে।</i>`,
          replyMarkup: {
            inline_keyboard: [
              [
                { text: '🔄 Code Expired / Resend Request', callback_data: `code_request:${order.order_id}` }
              ],
              [
                { text: '✅ Order Completed', callback_data: `status_delivered:${order.order_id}` }
              ],
              [
                { text: '❌ Cancel Order (বাতিল করুন)', callback_data: `cancel_prompt:${order.order_id}` }
              ]
            ]
          }
        };
      } else {
        // Stage 1: Claimed, waiting for worker to request the code from customer
        return {
          cardHtml:
`✅ <b>ORDER CLAIMED — REQUEST CODE / কোড রিকোয়েস্ট করুন</b>${codeBanner}
📦 <b>Order ID:</b> <code>${order.order_id}</code>
👷 <b>Assigned Worker:</b> <b>${workerName}</b>
💰 <b>Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>${proofLines ? `\n${proofLines}` : ''}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>${customNotesLine}

🕹️ <b>Service / Game:</b> <b>${gameTitle}</b>
${accountInfo.emoji} <b>${accountInfo.labelEn}:</b> <code>${playerUid}</code>${passwordLine}

💎 <b>Packages:</b>
${itemsText}

📧 <b>ACTION REQUIRED:</b>
লগইন করার সময় সাইট ইমেইলে ভেরিফিকেশন কোড চাইবে। নিচের বাটনে চাপ দিয়ে কাস্টমারকে কোড দিতে বলুন — কাস্টমারের WhatsApp-এ মেসেজ চলে যাবে।`,
          replyMarkup: {
            inline_keyboard: [
              [
                { text: '📧 Request Verification Code', callback_data: `code_request:${order.order_id}` }
              ],
              [
                { text: '❌ Cancel Order (বাতিল করুন)', callback_data: `cancel_prompt:${order.order_id}` }
              ]
            ]
          }
        };
      }
    }

    const claimedTitle = isAutoVerified 
      ? `✅ <b>ORDER CLAIMED [AUTO-PAID] / অর্ডার গ্রহণ করা হয়েছে</b>` 
      : `✅ <b>ORDER CLAIMED / অর্ডার গ্রহণ করা হয়েছে</b>`;

    return {
      cardHtml: 
`${claimedTitle}${qrBanner}
📦 <b>Order ID:</b> <code>${order.order_id}</code>
👷 <b>Assigned Worker:</b> <b>${workerName}</b>
💰 <b>Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>${proofLines ? `\n${proofLines}` : ''}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>${customNotesLine}

🕹️ <b>Service / Game:</b> <b>${gameTitle}</b>
${accountInfo.emoji} <b>${accountInfo.labelEn}:</b> <code>${playerUid}</code>${passwordLine}

💎 <b>Packages:</b>
${itemsText}

<i>Worker: Process the order and click below when complete or cancel if invalid:</i>`,
      replyMarkup: {
        inline_keyboard: [
          [
            { text: '✅ Order Completed (ডেলিভারি সম্পন্ন)', callback_data: `status_delivered:${order.order_id}` }
          ],
          [
            { text: '❌ Cancel Order (বাতিল করুন)', callback_data: `cancel_prompt:${order.order_id}` }
          ]
        ]
      }
    };
  }

  if (order.status === 'OUT_FOR_DELIVERY') {
    const processingTitle = isAutoVerified 
      ? `⚡ <b>PROCESSING [AUTO-PAID] / প্রসেসিং চলছে</b>` 
      : `⚡ <b>PROCESSING ORDER / প্রসেসিং চলছে</b>`;

    return {
      cardHtml: 
`${processingTitle}${qrBanner}
📦 <b>Order ID:</b> <code>${order.order_id}</code>
👷 <b>Assigned Worker:</b> <b>${workerName}</b>
💰 <b>Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>${proofLines ? `\n${proofLines}` : ''}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>${customNotesLine}

🕹️ <b>Service / Game:</b> <b>${gameTitle}</b>
${accountInfo.emoji} <b>${accountInfo.labelEn}:</b> <code>${playerUid}</code>${passwordLine}

💎 <b>Packages:</b>
${itemsText}

<i>Click below once order is completed or cancel if invalid:</i>`,
      replyMarkup: {
        inline_keyboard: [
          [
            { text: '✅ Order Completed', callback_data: `status_delivered:${order.order_id}` }
          ],
          [
            { text: '❌ Cancel Order (বাতিল করুন)', callback_data: `cancel_prompt:${order.order_id}` }
          ]
        ]
      }
    };
  }

  if (order.status === 'DELIVERED') {
    const deliveredTitle = isAutoVerified 
      ? `🎉 <b>ORDER COMPLETED & DELIVERED [AUTO-PAID]</b>` 
      : `🎉 <b>ORDER COMPLETED & DELIVERED / সম্পন্ন হয়েছে</b>`;

    return {
      cardHtml: 
`${deliveredTitle}${qrBanner}
📦 <b>Order ID:</b> <code>${order.order_id}</code>
👷 <b>Processed by:</b> <b>${workerName}</b>
💰 <b>Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>${proofLines ? `\n${proofLines}` : ''}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>${customNotesLine}

🕹️ <b>Service / Game:</b> <b>${gameTitle}</b>
${accountInfo.emoji} <b>${accountInfo.labelEn}:</b> <code>${playerUid}</code>${passwordLine}

💎 <b>Packages:</b>
${itemsText}
🕒 <b>Completed at:</b> ${new Date().toLocaleTimeString()}`,
      replyMarkup: {
        inline_keyboard: []
      }
    };
  }

  if (order.status === 'CANCELLED') {
    let cancelReason = 'No reason provided';
    if (order.customer_notes && !order.customer_notes.match(/^(?:PUBG UID|Free Fire UID|UID|Player UID|Account|Email|State Bot Order):/i)) {
      cancelReason = order.customer_notes;
    }
    const refundNotice = isAutoVerified 
      ? `\n💸 <b>রিফান্ড স্ট্যাটাস:</b> অটো-পেইড অর্ডার — অ্যাডমিন প্যানেল থেকে কাস্টমারকে রিফান্ড প্রদান করতে হবে।` 
      : '';
    return {
      cardHtml: 
`❌ <b>ORDER CANCELLED / অর্ডার বাতিল করা হয়েছে</b>${qrBanner}
📦 <b>Order ID:</b> <code>${order.order_id}</code>
👷 <b>Handled by:</b> <b>${workerName}</b>
💰 <b>Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>${proofLines ? `\n${proofLines}` : ''}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>
⚠️ <b>Reason / কারণ:</b> ${cancelReason}${refundNotice}

🕹️ <b>Service / Game:</b> <b>${gameTitle}</b>
${accountInfo.emoji} <b>${accountInfo.labelEn}:</b> <code>${playerUid}</code>${passwordLine}

💎 <b>Packages:</b>
${itemsText}
🕒 <b>Cancelled at:</b> ${new Date().toLocaleTimeString()}

<i>⚠️ This order is cancelled. No further worker action needed.</i>`,
      replyMarkup: {
        inline_keyboard: []
      }
    };
  }

  // Netflix / Crunchyroll: preset account already sent on WhatsApp — worker still claims for OTP
  if (
    order.status === 'PENDING_CLAIM' &&
    ((isNetflix && hasNetflixCredsSent) || (isCrunchyroll && hasCrunchyrollCredsSent))
  ) {
    const syntheticOrder = { ...order, status: 'PROCESSING' as Order['status'] };
    const { cardHtml, replyMarkup } = generateOrderCard(syntheticOrder, workerName, queueCount);
    const autoBanner = isNetflix
      ? '\n🤖 <b>[AUTO-DELIVERED FROM PACKAGE PRESET]</b>\n'
      : '\n🤖 <b>[AUTO-DELIVERED FROM PACKAGE PRESET]</b>\n';
    const claimRow = [
      {
        text: '⚡ Claim Order (OTP / সহায়তা)',
        callback_data: `claim:${order.order_id}`
      }
    ];
    const existingRows = replyMarkup?.inline_keyboard || [];
    return {
      cardHtml: cardHtml.includes('[AUTO-DELIVERED')
        ? cardHtml
        : cardHtml.replace(isNetflix ? netflixBanner : crunchyrollBanner, autoBanner + (isNetflix ? netflixBanner : crunchyrollBanner)),
      replyMarkup: {
        inline_keyboard: [claimRow, ...existingRows]
      }
    };
  }

  // Default: PENDING_CLAIM / PENDING_PAYMENT
  const pendingQrHint = isQrOrder 
    ? `\n📲 <i>কর্মী: অর্ডার Claim করুন এবং লগইন QR কোড স্ক্রিনশট পাঠিয়ে কাস্টমারকে দিন।</i>`
    : `\n<i>Click below to claim and process this order:</i>`;

  const queueBadge = queueCount && queueCount > 0
    ? `\n📬 <b>Queue:</b> <b>${queueCount} more order${queueCount > 1 ? 's' : ''} waiting in line</b>\n`
    : '';

  const newOrderTitle = isAutoVerified 
    ? `🟢 <b>NEW ORDER [AUTO-PAID] / নতুন পেইড অর্ডার</b>` 
    : `🚨 <b>NEW ORDER / নতুন অর্ডার</b>`;

  return {
    cardHtml: 
`${newOrderTitle}${qrBanner}
📦 <b>Order ID:</b> <code>${order.order_id}</code>
💰 <b>Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>${proofLines ? `\n${proofLines}` : ''}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>${customNotesLine}

🕹️ <b>Service / Game:</b> <b>${gameTitle}</b>
${accountInfo.emoji} <b>${accountInfo.labelEn}:</b> <code>${playerUid}</code>${passwordLine}

💎 <b>Packages:</b>
${itemsText}
${queueBadge}${pendingQrHint}`,
    replyMarkup: {
      inline_keyboard: [
        [
          {
            text: '⚡ Claim Order (অর্ডার গ্রহণ করুন)',
            callback_data: `claim:${order.order_id}`
          }
        ]
      ]
    }
  };
}
