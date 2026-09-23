import { Order } from '@/types';
import { db } from '../db';
import { whatsappService } from '../whatsapp/service';
import { env } from '../config/env';
import { storageService } from '../supabase/storage';
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

export const telegramBot = {
  /**
   * Pending cancellation session helpers
   */
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
  },
  /**
   * Helper to build dynamic HTML card and inline keyboard for any order state
   */
  generateOrderCard(
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

    const isQrOrder = 
      gameTitle.toLowerCase().includes('qr') || 
      (firstItem?.product_name || '').toLowerCase().includes('qr') ||
      (order.customer_notes || '').toLowerCase().includes('pubg_login') ||
      (order.customer_notes || '').toLowerCase().includes('login uc');

    const qrBanner = isQrOrder ? `\n📲 <b>[PUBG QR LOGIN ORDER]</b>\n` : '';
    const hasQrSent = (order.customer_notes || '').includes('QR Code forwarded') || (order.customer_notes || '').includes('Storage:');
    const hasQrScanned = (order.customer_notes || '').includes('Customer Scanned') || (order.customer_notes || '').includes('QR_SCANNED');

    // Email Verification "Code Method" orders (PUBG KR + eFootball Android/iOS only)
    const isCodeOrder =
      gameTitle.toLowerCase().includes('korean') ||
      gameTitle.toLowerCase().includes('efootball') ||
      (firstItem?.product_name || '').toLowerCase().includes('korean') ||
      (firstItem?.product_name || '').toLowerCase().includes('efootball');

    const codeBanner = isCodeOrder ? `\n📧 <b>[EMAIL CODE VERIFICATION ORDER]</b>\n` : '';
    const codeNotes = order.customer_notes || '';
    const lastCodeRequestIdx = codeNotes.lastIndexOf('CODE_REQUESTED');
    const lastCodeReceivedIdx = codeNotes.lastIndexOf('CODE_RECEIVED:');
    const hasCodeRequested = lastCodeRequestIdx !== -1;
    const hasCodeReceived = lastCodeReceivedIdx !== -1 && lastCodeReceivedIdx > lastCodeRequestIdx;
    const receivedCode = hasCodeReceived
      ? (codeNotes.slice(lastCodeReceivedIdx).match(/CODE_RECEIVED:\s*([^|]+)/i)?.[1] || '').trim()
      : '';

    if (order.status === 'CLAIMED' || order.status === 'PROCESSING') {
      if (isQrOrder) {
        if (hasQrScanned) {
          // Stage 3: Customer Scanned QR -> Worker should finish and click Completed
          return {
            cardHtml: 
`🎯 <b>CUSTOMER SCANNED QR! / গ্রাহক স্ক্যান সম্পন্ন করেছেন</b>${qrBanner}
📦 <b>Order ID:</b> <code>${order.order_id}</code>
🕹️ <b>Service / Game:</b> <b>${gameTitle}</b>
👷 <b>Assigned Worker:</b> <b>${workerName}</b>
${accountInfo.emoji} <b>${accountInfo.labelEn}:</b> <code>${playerUid}</code>
💰 <b>Total Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>
${proofLines}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>

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
🕹️ <b>Service / Game:</b> <b>${gameTitle}</b>
👷 <b>Assigned Worker:</b> <b>${workerName}</b>
${accountInfo.emoji} <b>${accountInfo.labelEn}:</b> <code>${playerUid}</code>
💰 <b>Total Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>
${proofLines}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>

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
🕹️ <b>Service / Game:</b> <b>${gameTitle}</b>
👷 <b>Assigned Worker:</b> <b>${workerName}</b>
${accountInfo.emoji} <b>${accountInfo.labelEn}:</b> <code>${playerUid}</code>
💰 <b>Total Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>
${proofLines}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>
📝 <b>Notes:</b> ${order.customer_notes || 'None'}

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
🕹️ <b>Service / Game:</b> <b>${gameTitle}</b>
👷 <b>Assigned Worker:</b> <b>${workerName}</b>
${accountInfo.emoji} <b>${accountInfo.labelEn}:</b> <code>${playerUid}</code>
🔑 <b>Verification Code:</b> <code>${receivedCode || 'N/A'}</code>
💰 <b>Total Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>
${proofLines}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>

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
🕹️ <b>Service / Game:</b> <b>${gameTitle}</b>
👷 <b>Assigned Worker:</b> <b>${workerName}</b>
${accountInfo.emoji} <b>${accountInfo.labelEn}:</b> <code>${playerUid}</code>
💰 <b>Total Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>
${proofLines}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>

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
🕹️ <b>Service / Game:</b> <b>${gameTitle}</b>
👷 <b>Assigned Worker:</b> <b>${workerName}</b>
${accountInfo.emoji} <b>${accountInfo.labelEn}:</b> <code>${playerUid}</code>
💰 <b>Total Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>
${proofLines}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>
📝 <b>Notes:</b> ${order.customer_notes || 'None'}

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
🕹️ <b>Service / Game:</b> <b>${gameTitle}</b>
👷 <b>Assigned Worker:</b> <b>${workerName}</b>
${accountInfo.emoji} <b>${accountInfo.labelEn}:</b> <code>${playerUid}</code>
💰 <b>Total Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>
${proofLines}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>
📝 <b>Notes:</b> ${order.customer_notes || 'None'}

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
🕹️ <b>Service / Game:</b> <b>${gameTitle}</b>
👷 <b>Assigned Worker:</b> <b>${workerName}</b>
${accountInfo.emoji} <b>${accountInfo.labelEn}:</b> <code>${playerUid}</code>
💰 <b>Total Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>
${proofLines}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>

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
🕹️ <b>Service / Game:</b> <b>${gameTitle}</b>
${accountInfo.emoji} <b>${accountInfo.labelEn}:</b> <code>${playerUid}</code>
👷 <b>Processed by:</b> <b>${workerName}</b>
💰 <b>Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>
${proofLines}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>
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
🕹️ <b>Service / Game:</b> <b>${gameTitle}</b>
${accountInfo.emoji} <b>${accountInfo.labelEn}:</b> <code>${playerUid}</code>
👷 <b>Handled by:</b> <b>${workerName}</b>
⚠️ <b>Reason / কারণ:</b> ${cancelReason}${refundNotice}
💰 <b>Total Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>
${proofLines}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>
🕒 <b>Cancelled at:</b> ${new Date().toLocaleTimeString()}

<i>⚠️ This order is cancelled. No further worker action needed.</i>`,
        replyMarkup: {
          inline_keyboard: []
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
🕹️ <b>Service / Game:</b> <b>${gameTitle}</b>
${accountInfo.emoji} <b>${accountInfo.labelEn}:</b> <code>${playerUid}</code>
💰 <b>Total Amount:</b> ৳${order.total_amount}
💳 <b>Payment:</b> <b>${methodLabel}</b>
${proofLines}
📞 <b>Customer Phone:</b> <code>${order.delivery_phone}</code>
📝 <b>Notes:</b> ${order.customer_notes || 'None'}

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
  },

  /**
   * Send new order card to the Telegram Worker Group with Claim button
   */
  async dispatchNewOrder(order: Order, queueCount?: number): Promise<{ success: boolean; messageId?: number; error?: string }> {
    if (!env.telegram.isConfigured) {
      const errorMsg = 'Telegram Worker Bot not configured in environment';
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    const { cardHtml, replyMarkup } = this.generateOrderCard(order, undefined, queueCount);

    try {
      const response = await fetch(`${env.telegram.apiUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.telegram.workerGroupId,
          text: cardHtml,
          parse_mode: 'HTML',
          reply_markup: replyMarkup
        })
      });

      const data = await response.json();
      if (data.ok && data.result?.message_id) {
        order.telegram_message_id = data.result.message_id;
        await db.updateOrderTelegramMessageId(order.id, data.result.message_id);
        return { success: true, messageId: data.result.message_id };
      }
      console.error('Telegram API Dispatch Error:', data);
      return { success: false, error: data.description || 'Failed to dispatch to Telegram' };
    } catch (err) {
      console.error('Telegram API Network Error:', err);
      return { success: false, error: String(err) };
    }
  },

  /**
   * Synchronize Telegram message state when order is modified from the website
   * Removes previous message (if any) and sends the new state card, updating telegram_message_id
   */
  async syncOrderStatus(
    order: Order,
    options: { deletePrevious?: boolean; workerName?: string } = { deletePrevious: true }
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    if (!env.telegram.isConfigured) {
      return { success: false, error: 'Telegram bot not configured' };
    }

    const { cardHtml, replyMarkup } = this.generateOrderCard(order, options.workerName);
    const prevMsgId = order.telegram_message_id;

    console.log(`[Telegram Sync] Syncing Order #${order.order_id} -> Status: ${order.status} | Prev Msg ID: ${prevMsgId}`);

    // If we want to delete previous message and post new state
    if (options.deletePrevious && prevMsgId) {
      const deleted = await this.deleteMessage(env.telegram.workerGroupId, prevMsgId);
      console.log(`[Telegram Sync] Deleted previous message ${prevMsgId}: ${deleted}`);
    }

    // Send the new status card
    try {
      const response = await fetch(`${env.telegram.apiUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.telegram.workerGroupId,
          text: cardHtml,
          parse_mode: 'HTML',
          reply_markup: replyMarkup
        })
      });

      const data = await response.json();
      if (data.ok && data.result?.message_id) {
        const newMsgId = data.result.message_id;
        order.telegram_message_id = newMsgId;
        await db.updateOrderTelegramMessageId(order.id, newMsgId);
        return { success: true, messageId: newMsgId };
      }

      // Fallback: If sendMessage failed after delete attempt or if delete was skipped, try editMessageText on prevMsgId
      if (prevMsgId) {
        console.warn(`[Telegram Sync] Falling back to editMessageText for msg ${prevMsgId}`);
        await this.editMessageText(env.telegram.workerGroupId, prevMsgId, cardHtml, replyMarkup);
        return { success: true, messageId: prevMsgId };
      }

      return { success: false, error: data.description || 'Failed to sync to Telegram' };
    } catch (err) {
      console.error('[Telegram Sync Network Error]:', err);
      return { success: false, error: String(err) };
    }
  },

  /**
   * Handle interactive callback queries from Telegram inline buttons
   */
  async handleCallbackQuery(callbackQuery: {
    id: string;
    from: { id: number; first_name: string; last_name?: string; username?: string };
    message?: { message_id: number; chat: { id: number | string } };
    data?: string;
  }): Promise<{ success: boolean; message: string; alertText?: string }> {
    const { id, from, message, data } = callbackQuery;
    if (!data) {
      await this.answerCallbackQuery(id, '⚠️ Invalid action', true);
      return { success: false, message: 'No callback data' };
    }

    const parts = data.split(':');
    const action = parts[0];
    const orderIdCode = (parts[1] || '').trim();
    const extraParam = parts.slice(2).join(':');
    const workerName = [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || `Worker-${from.id}`;

    console.log(`[Telegram Callback] Action: "${action}" | OrderCode: "${orderIdCode}" | Extra: "${extraParam}" | Worker: "${workerName}" (ID: ${from.id})`);

    const existingOrder = await db.getOrderByCode(orderIdCode);
    if (!existingOrder) {
      await this.answerCallbackQuery(id, '⚠️ Order not found in database', true);
      return { success: false, message: 'Order not found' };
    }

    if (existingOrder.status === 'CANCELLED') {
      await this.answerCallbackQuery(
        id,
        '❌ এই অর্ডারটি অ্যাডমিন কর্তৃক বাতিল করা হয়েছে (This order was cancelled by Admin).',
        true
      );
      return { success: false, message: 'Order is cancelled' };
    }

    const assignedWorker = existingOrder.current_worker ||
      existingOrder.assignments?.find(a => ['CLAIMED', 'PROCESSING', 'OUT_FOR_DELIVERY'].includes(a.status))?.worker;
    const assignedTelegramId = assignedWorker?.telegram_user_id;
    const assignedWorkerName = assignedWorker?.full_name || 'অন্য একজন কর্মী';

    // QR Interactive Hints
    if (action === 'qr_hint') {
      const hasQrSent = 
        (existingOrder.customer_notes || '').includes('QR Code forwarded') || 
        (existingOrder.customer_notes || '').includes('Storage:') ||
        existingOrder.status === 'PROCESSING' ||
        existingOrder.status === 'DELIVERED';

      // If the screenshot has already been dropped/sent, suppress the modal completely!
      if (hasQrSent) {
        await this.answerCallbackQuery(
          id,
          '✅ QR কোড ইতোমধ্যে পাঠানো হয়েছে! কাস্টমার স্ক্যান করার অপেক্ষায় রয়েছে।',
          false
        );
        return { success: true, message: 'QR already sent, hint suppressed' };
      }

      // Only show popup modal if admin has NOT dropped the image yet and clicks send screenshot button
      await this.answerCallbackQuery(
        id,
        '📸 অনুগ্রহ করে এই মেসেজে রিপ্লাই করে লগইন QR কোডের ছবি/স্ক্রিনশট পাঠান। বট সাথে সাথে কাস্টমারের WhatsApp-এ পাঠিয়ে দেবে।',
        true
      );
      return { success: true, message: 'QR hint shown' };
    }

    if (action === 'qr_waiting') {
      await this.answerCallbackQuery(
        id,
        '⏳ কাস্টমারের WhatsApp-এ QR কোড পাঠানো হয়েছে (৫ মিনিট মেয়াদ)। কাস্টমার স্ক্যান করলে আপনাকে সাথে সাথে এখানে নোটিফাই করা হবে।',
        false
      );
      return { success: true, message: 'QR waiting info shown' };
    }

    if (action === 'qr_resend_hint') {
      await this.answerCallbackQuery(
        id,
        '🔄 নতুন QR পাঠাতে এই কার্ডে রিপ্লাই করে আরেকটি স্ক্রিনশট সেন্ড করুন।',
        false
      );
      return { success: true, message: 'QR resend hint shown' };
    }

    // Email Verification "Code Method" action (PUBG KR / eFootball) — worker requests/re-requests code
    if (action === 'code_request') {
      // Must be claimed first
      if (!assignedTelegramId || existingOrder.status === 'PENDING_CLAIM' || existingOrder.status === 'PENDING_PAYMENT') {
        await this.answerCallbackQuery(id, `⚠️ প্রথমে 'Claim Order' বাটনে ক্লিক করে অর্ডারটি গ্রহণ করুন!`, true);
        return { success: false, message: 'Order must be claimed first' };
      }

      // Check worker lock
      if (assignedTelegramId !== from.id) {
        await this.answerCallbackQuery(
          id,
          `⛔ একশন বাতিল!\nএই অর্ডারটি [${assignedWorkerName}] ক্লেইম করেছেন। শুধুমাত্র তিনি অথবা অ্যাডমিন প্যানেল এতে একশন নিতে পারবেন।`,
          true
        );
        return { success: false, message: `Unauthorized: Claimed by ${assignedWorkerName}` };
      }

      const isResend = (existingOrder.customer_notes || '').includes('CODE_REQUESTED');

      try {
        const sendResult = await whatsappService.sendVerificationCodeRequest(existingOrder.delivery_phone, existingOrder.order_id, isResend);
        if (!sendResult.success) {
          await this.answerCallbackQuery(id, `⚠️ কাস্টমারকে নোটিফাই করা যায়নি: ${sendResult.error || 'Unknown error'}`, true);
          return { success: false, message: sendResult.error || 'Failed to notify customer' };
        }

        // Put the customer's WhatsApp session into AWAITING_VERIFICATION_CODE mode so the next text they send is captured as the code
        try {
          const conversation = await db.getOrCreateConversation(existingOrder.delivery_phone);
          const currentSession = db.getSessionState(conversation.id);
          db.setSessionState(conversation.id, {
            step: 'AWAITING_VERIFICATION_CODE',
            draftOrder: { ...currentSession.draftOrder, pendingOrderId: existingOrder.order_id }
          });
        } catch (convErr) {
          console.error('[Telegram code_request] Failed to set customer session state:', convErr);
        }

        const updatedNotes = `${existingOrder.customer_notes || ''} | CODE_REQUESTED:${new Date().toLocaleTimeString()}`;
        await db.updateOrderStatus(existingOrder.order_id, existingOrder.status, { notes: updatedNotes });

        const refreshedOrder = (await db.getOrderByCode(existingOrder.order_id)) || existingOrder;

        if (message) {
          const { cardHtml, replyMarkup } = this.generateOrderCard(refreshedOrder, workerName);
          await this.editMessageText(message.chat.id, message.message_id, cardHtml, replyMarkup);
        }

        await this.answerCallbackQuery(
          id,
          isResend ? '🔄 কাস্টমারকে নতুন কোডের জন্য নোটিফাই করা হয়েছে!' : '📧 কাস্টমারকে কোডের জন্য নোটিফাই করা হয়েছে!',
          false
        );
        return { success: true, message: 'Code request sent to customer' };
      } catch (codeErr) {
        console.error('[Telegram code_request Error]:', codeErr);
        await this.answerCallbackQuery(id, `⚠️ Error requesting code: ${String(codeErr)}`, true);
        return { success: false, message: String(codeErr) };
      }
    }

    // 1. ACTION: CLAIM ORDER
    if (action === 'claim') {
      // If already claimed by another worker
      if (
        ['CLAIMED', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(existingOrder.status) &&
        assignedTelegramId &&
        assignedTelegramId !== from.id
      ) {
        await this.answerCallbackQuery(
          id,
          `⛔ একশন বাতিল!\nএই অর্ডারটি ইতোমধ্যে [${assignedWorkerName}] ক্লেইম করেছেন। অন্য কোনো কর্মী এতে একশন নিতে পারবেন না (শুধুমাত্র অ্যাডমিন প্যানেল পরিবর্তন করতে পারে)।`,
          true
        );
        return { success: false, message: `Order already claimed by ${assignedWorkerName}` };
      }

      try {
        const claimResult = await db.claimOrderAtomic({
          orderIdCode,
          telegramUserId: from.id,
          workerName,
          telegramUsername: from.username
        });

        if (!claimResult.success) {
          await this.answerCallbackQuery(id, `⚠️ ${claimResult.message}`, true);
          return { success: false, message: claimResult.message, alertText: claimResult.message };
        }

        const order = claimResult.order;
        
        // Update Telegram Card UI in Group to show claimed status and operational buttons
        if (message && order) {
          const { cardHtml, replyMarkup } = this.generateOrderCard(order, workerName);
          await this.editMessageText(message.chat.id, message.message_id, cardHtml, replyMarkup);
        }

        // Notify customer on WhatsApp (non-blocking)
        if (order) {
          whatsappService.sendOrderClaimedNotification(order, workerName).catch(err => {
            console.error('[Telegram->WhatsApp Notify Error on Claim]:', err);
          });
        }

        // Trigger queue to dispatch next order in line for other workers!
        import('./queue').then(m => m.telegramQueue.processNextInQueue()).catch(err => {
          console.warn('[Telegram Queue Auto-Dispatch Warning on Claim]:', err);
        });

        await this.answerCallbackQuery(id, `✅ You have successfully claimed top-up #${orderIdCode}!`, false);
        return { success: true, message: `Claimed by ${workerName}` };
      } catch (claimErr) {
        console.error('[Telegram Claim Error]:', claimErr);
        await this.answerCallbackQuery(id, `⚠️ Error claiming order: ${String(claimErr)}`, true);
        return { success: false, message: String(claimErr) };
      }
    }

    // 2. ACTION: OUT FOR DELIVERY / PROCESSING
    if (action === 'status_out') {
      // Must be claimed first
      if (!assignedTelegramId && (existingOrder.status === 'PENDING_CLAIM' || existingOrder.status === 'PENDING_PAYMENT')) {
        await this.answerCallbackQuery(id, `⚠️ প্রথমে 'Claim Top-Up' বাটনে ক্লিক করে অর্ডারটি গ্রহণ করুন!`, true);
        return { success: false, message: 'Order must be claimed first' };
      }

      // Check worker lock
      if (assignedTelegramId && assignedTelegramId !== from.id) {
        await this.answerCallbackQuery(
          id,
          `⛔ একশন বাতিল!\nএই অর্ডারটি [${assignedWorkerName}] ক্লেইম করেছেন। শুধুমাত্র তিনি অথবা অ্যাডমিন প্যানেল এতে একশন নিতে পারবেন।`,
          true
        );
        return { success: false, message: `Unauthorized: Claimed by ${assignedWorkerName}` };
      }

      try {
        const updateResult = await db.updateOrderStatus(orderIdCode, 'OUT_FOR_DELIVERY', { workerTelegramId: from.id });
        if (!updateResult.success) {
          await this.answerCallbackQuery(id, `⚠️ ${updateResult.message}`, true);
          return { success: false, message: updateResult.message || 'Update failed' };
        }
        const order = updateResult.order;
        
        if (message && order) {
          const { cardHtml, replyMarkup } = this.generateOrderCard(order, workerName);
          await this.editMessageText(message.chat.id, message.message_id, cardHtml, replyMarkup);
        }

        await this.answerCallbackQuery(id, `⚡ Top-up #${orderIdCode} is being processed!`, false);
        return { success: true, message: 'Status updated to OUT_FOR_DELIVERY' };
      } catch (err) {
        console.error('[Telegram Status Out Error]:', err);
        await this.answerCallbackQuery(id, `⚠️ Failed to update: ${String(err)}`, true);
        return { success: false, message: String(err) };
      }
    }

    // 3. ACTION: MARK DELIVERED / COMPLETED
    if (action === 'status_delivered') {
      // Must be claimed first
      if (!assignedTelegramId && (existingOrder.status === 'PENDING_CLAIM' || existingOrder.status === 'PENDING_PAYMENT')) {
        await this.answerCallbackQuery(id, `⚠️ প্রথমে 'Claim Top-Up' বাটনে ক্লিক করে অর্ডারটি গ্রহণ করুন!`, true);
        return { success: false, message: 'Order must be claimed first' };
      }

      // Check worker lock
      if (assignedTelegramId && assignedTelegramId !== from.id) {
        await this.answerCallbackQuery(
          id,
          `⛔ একশন বাতিল!\nএই অর্ডারটি [${assignedWorkerName}] ক্লেইম করেছেন। শুধুমাত্র তিনি অথবা অ্যাডমিন প্যানেল এটি সম্পন্ন করতে পারবেন।`,
          true
        );
        return { success: false, message: `Unauthorized: Claimed by ${assignedWorkerName}` };
      }

      try {
        const updateResult = await db.updateOrderStatus(orderIdCode, 'DELIVERED', { workerTelegramId: from.id });
        if (!updateResult.success) {
          await this.answerCallbackQuery(id, `⚠️ ${updateResult.message}`, true);
          return { success: false, message: updateResult.message || 'Delivery failed' };
        }
        const order = updateResult.order;

        if (order && message) {
          const { cardHtml, replyMarkup } = this.generateOrderCard(order, workerName);
          await this.editMessageText(message.chat.id, message.message_id, cardHtml, replyMarkup);

          // Clean up buttons or message from any previous card for this order if different
          if (order.telegram_message_id && order.telegram_message_id !== message.message_id) {
            try {
              await this.deleteMessage(message.chat.id, order.telegram_message_id);
            } catch {
              await this.editMessageReplyMarkup(message.chat.id, order.telegram_message_id, { inline_keyboard: [] });
            }
          }

          // Trigger automated WhatsApp delivery confirmation to customer (non-blocking)
          whatsappService.sendOrderDeliveredNotification(order).catch(err => {
            console.error('[Telegram->WhatsApp Notify Error on Delivered]:', err);
          });
        }

        // Trigger queue to dispatch next order in line
        import('./queue').then(m => m.telegramQueue.processNextInQueue()).catch(err => {
          console.warn('[Telegram Queue Auto-Dispatch Warning on Delivered]:', err);
        });

        await this.answerCallbackQuery(id, `🎉 Top-up #${orderIdCode} marked as Delivered!`, false);
        return { success: true, message: 'Delivered successfully' };
      } catch (err) {
        console.error('[Telegram Delivered Error]:', err);
        await this.answerCallbackQuery(id, `⚠️ Failed to mark delivered: ${String(err)}`, true);
        return { success: false, message: String(err) };
      }
    }

    // 4. ACTION: CANCEL PROMPT (Show Cancellation Reasons)
    if (action === 'cancel_prompt') {
      // Must be claimed first before cancellation
      if (!assignedTelegramId || existingOrder.status === 'PENDING_CLAIM' || existingOrder.status === 'PENDING_PAYMENT') {
        await this.answerCallbackQuery(
          id,
          `⚠️ প্রথমে 'Claim Order' বাটনে ক্লিক করে অর্ডারটি গ্রহণ করুন! ক্লেইম করার পরই কেবল বাতিল করা যাবে।`,
          true
        );
        return { success: false, message: 'Order must be claimed first before cancellation' };
      }

      // Check worker lock
      if (assignedTelegramId !== from.id) {
        await this.answerCallbackQuery(
          id,
          `⛔ একশন বাতিল!\nএই অর্ডারটি [${assignedWorkerName}] ক্লেইম করেছেন। শুধুমাত্র তিনি অথবা অ্যাডমিন প্যানেল এটি বাতিল করতে পারবেন।`,
          true
        );
        return { success: false, message: `Unauthorized: Claimed by ${assignedWorkerName}` };
      }

      // Reset any active pending custom cancellation mode if user navigated back to options
      this.clearPendingCancellation(from.id);

      const firstItem = existingOrder.items?.[0];
      const prodName = firstItem?.product_name || '';
      const playerUid = 
        existingOrder.player_uid || 
        (existingOrder.delivery_address as any)?.player_uid || 
        (existingOrder.delivery_address as any)?.name ||
        existingOrder.delivery_address?.address?.match(/(?:UID|Player UID|Email|Gmail|Account|ID):\s*([0-9a-zA-Z@._+-]+)/i)?.[1] ||
        'N/A';
      const accountInfo = getAccountFieldInfo(playerUid, prodName);

      const invoiceId = 
        existingOrder.invoice_id || 
        (existingOrder.delivery_address as any)?.invoice_id || 
        existingOrder.customer_notes?.match(/Invoice:\s*([a-zA-Z0-9_-]+)/i)?.[1] || 
        '';

      const isAutoVerified = Boolean(
        invoiceId ||
        existingOrder.payment_method?.toUpperCase().includes('ZINIPAY') || 
        existingOrder.trx_id?.toUpperCase().startsWith('ZINI') ||
        existingOrder.customer_notes?.includes('Payment Verified via ZiniPay')
      );

      const autoPaidWarning = isAutoVerified 
        ? `\n🟢 <b>পেমেন্ট:</b> ZiniPay অটো-পেইড (Invoice: <code>${invoiceId || 'VERIFIED'}</code>)\n⚠️ <i>(সতর্কতা: এই অর্ডার বাতিল করলে গ্রাহককে অ্যাডমিন প্যানেল থেকে ম্যানুয়াল রিফান্ড দিতে হবে)</i>\n` 
        : '';

      const promptHtml = 
`⚠️ <b>CANCEL ORDER / অর্ডার বাতিলের কারণ নির্বাচন করুন</b>

📦 <b>Order ID:</b> <code>${existingOrder.order_id}</code>
${accountInfo.emoji} <b>${accountInfo.labelEn}:</b> <code>${playerUid}</code>
👷 <b>Worker:</b> <b>${workerName}</b>${autoPaidWarning}
<i>অনুগ্রহ করে নিচে থেকে বাতিলের সুনির্দিষ্ট কারণ নির্বাচন করুন অথবা নিজে কারণ লিখুন:</i>`;

      const promptMarkup = {
        inline_keyboard: [
          [
            { text: `🚫 ভুল ${accountInfo.labelBn} / Invalid`, callback_data: `cancel_confirm:${existingOrder.order_id}:invalid_info` }
          ],
          [
            isAutoVerified
              ? { text: '💸 রিফান্ড প্রয়োজন (Refund Needed)', callback_data: `cancel_confirm:${existingOrder.order_id}:refund_needed` }
              : { text: '💳 ভুয়া / ইনভ্যালিড TrxID', callback_data: `cancel_confirm:${existingOrder.order_id}:fake_trxid` }
          ],
          [
            { text: '📉 স্টক শেষ / সার্ভার সমস্যা', callback_data: `cancel_confirm:${existingOrder.order_id}:stock_out` }
          ],
          [
            { text: '✍️ নিজে কারণ লিখুন (Write Custom Reason)', callback_data: `cancel_custom_prompt:${existingOrder.order_id}` }
          ],
          [
            { text: '👤 কাস্টমার রিকোয়েস্ট (Customer Requested)', callback_data: `cancel_confirm:${existingOrder.order_id}:customer_req` }
          ],
          [
            { text: '🔙 ফিরে যান (Back to Order)', callback_data: `cancel_back:${existingOrder.order_id}` }
          ]
        ]
      };

      if (message) {
        await this.editMessageText(message.chat.id, message.message_id, promptHtml, promptMarkup);
      }

      await this.answerCallbackQuery(id, 'বাতিলের কারণ নির্বাচন করুন বা লিখুন', false);
      return { success: true, message: 'Cancellation reason prompt displayed' };
    }

    // 4b. ACTION: CANCEL CUSTOM PROMPT (Worker wants to write custom reason)
    if (action === 'cancel_custom_prompt') {
      // Must be claimed first before cancellation
      if (!assignedTelegramId || existingOrder.status === 'PENDING_CLAIM' || existingOrder.status === 'PENDING_PAYMENT') {
        await this.answerCallbackQuery(
          id,
          `⚠️ প্রথমে 'Claim Order' বাটনে ক্লিক করে অর্ডারটি গ্রহণ করুন! ক্লেইম করার পরই কেবল বাতিল করা যাবে।`,
          true
        );
        return { success: false, message: 'Order must be claimed first before cancellation' };
      }

      // Check worker lock
      if (assignedTelegramId !== from.id) {
        await this.answerCallbackQuery(
          id,
          `⛔ একশন বাতিল!\nএই অর্ডারটি [${assignedWorkerName}] ক্লেইম করেছেন। শুধুমাত্র তিনি অথবা অ্যাডমিন প্যানেল এটি বাতিল করতে পারবেন।`,
          true
        );
        return { success: false, message: `Unauthorized: Claimed by ${assignedWorkerName}` };
      }

      const firstItem = existingOrder.items?.[0];
      const prodName = firstItem?.product_name || '';
      const playerUid = 
        existingOrder.player_uid || 
        (existingOrder.delivery_address as any)?.player_uid || 
        (existingOrder.delivery_address as any)?.name ||
        existingOrder.delivery_address?.address?.match(/(?:UID|Player UID|Email|Gmail|Account|ID):\s*([0-9a-zA-Z@._+-]+)/i)?.[1] ||
        'N/A';
      const accountInfo = getAccountFieldInfo(playerUid, prodName);

      // Register pending cancellation session for this worker
      this.setPendingCancellation(from.id, {
        orderIdCode: existingOrder.order_id,
        workerTelegramId: from.id,
        workerName,
        chatId: message?.chat.id,
        messageId: message?.message_id
      });

      const customPromptHtml = 
`✍️ <b>CANCEL ORDER / অর্ডার বাতিলের কারণ লিখুন</b>

📦 <b>Order ID:</b> <code>${existingOrder.order_id}</code>
${accountInfo.emoji} <b>${accountInfo.labelEn}:</b> <code>${playerUid}</code>
👷 <b>Worker:</b> <b>${workerName}</b>

<i>অনুগ্রহ করে নিচে রিপ্লাই (Reply) করে অথবা সরাসরি চ্যাটে বাতিলের কারণ লিখে পাঠান।</i>

<b>উদাহরণ:</b>
• আইডি পাসওয়ার্ড ভুল
• ২-স্টেপ ভেরিফিকেশন অন, ব্যাকআপ কোড দিন
• প্লেয়ার লেভেল কম, গিফট দেওয়া যাচ্ছে না
• পেমেন্টের তথ্য মেলেনি

<i>(বাতিল করতে না চাইলে নিচের 'ফিরে যান' বাটনে ক্লিক করুন)</i>`;

      const customPromptMarkup = {
        inline_keyboard: [
          [
            { text: '🔙 কারণ তালিকায় ফিরুন (Reason List)', callback_data: `cancel_prompt:${existingOrder.order_id}` }
          ],
          [
            { text: '❌ ফিরে যান (Back to Order)', callback_data: `cancel_back:${existingOrder.order_id}` }
          ]
        ]
      };

      if (message) {
        await this.editMessageText(message.chat.id, message.message_id, customPromptHtml, customPromptMarkup);

        // Send a force-reply trigger message so Telegram automatically focuses input in reply mode
        try {
          await this.sendMessage(message.chat.id, `✍️ <b>[${workerName}]</b>, #${existingOrder.order_id} অর্ডারটি বাতিলের কারণ লিখে পাঠান:\n<i>(এই মেসেজটিতে রিপ্লাই করে কারণটি টাইপ করুন)</i>`, {
            reply_to_message_id: message.message_id,
            reply_markup: {
              force_reply: true,
              selective: true,
              input_field_placeholder: 'অর্ডার বাতিলের সুনির্দিষ্ট কারণ লিখুন...'
            }
          });
        } catch (promptErr) {
          console.error('Failed to dispatch force-reply prompt:', promptErr);
        }
      }

      await this.answerCallbackQuery(id, '✍️ এবার চ্যাটে বাতিলের কারণ লিখে পাঠান', false);
      return { success: true, message: 'Custom cancellation prompt active' };
    }

    // 5. ACTION: CANCEL BACK (Return to claimed order view)
    if (action === 'cancel_back') {
      this.clearPendingCancellation(from.id);
      if (message) {
        const { cardHtml, replyMarkup } = this.generateOrderCard(existingOrder, assignedWorkerName || workerName);
        await this.editMessageText(message.chat.id, message.message_id, cardHtml, replyMarkup);
      }
      await this.answerCallbackQuery(id, 'ফিরে আসা হয়েছে', false);
      return { success: true, message: 'Returned to order view' };
    }

    // 6. ACTION: CANCEL CONFIRM (Execute cancellation with reason)
    if (action === 'cancel_confirm') {
      // Must be claimed first before cancellation
      if (!assignedTelegramId || existingOrder.status === 'PENDING_CLAIM' || existingOrder.status === 'PENDING_PAYMENT') {
        await this.answerCallbackQuery(
          id,
          `⚠️ প্রথমে 'Claim Order' বাটনে ক্লিক করে অর্ডারটি গ্রহণ করুন! ক্লেইম করার পরই কেবল বাতিল করা যাবে।`,
          true
        );
        return { success: false, message: 'Order must be claimed first before cancellation' };
      }

      // Check worker lock
      if (assignedTelegramId !== from.id) {
        await this.answerCallbackQuery(
          id,
          `⛔ একশন বাতিল!\nএই অর্ডারটি [${assignedWorkerName}] ক্লেইম করেছেন। শুধুমাত্র তিনি অথবা অ্যাডমিন প্যানেল এটি বাতিল করতে পারবেন।`,
          true
        );
        return { success: false, message: `Unauthorized: Claimed by ${assignedWorkerName}` };
      }

      const parts = data.split(':');
      const targetOrderIdCode = parts[1];
      const rawReason = parts.slice(2).join(':') || 'Worker cancelled';
      const cancelReason = resolveCancelReason(rawReason, existingOrder);

      const result = await this.executeOrderCancellation({
        orderIdCode: targetOrderIdCode,
        cancelReason,
        workerTelegramId: from.id,
        workerName,
        workerUsername: from.username,
        chatId: message?.chat.id,
        messageId: message?.message_id
      });

      if (!result.success) {
        await this.answerCallbackQuery(id, `⚠️ ${result.message}`, true);
        return { success: false, message: result.message };
      }

      await this.answerCallbackQuery(id, `❌ অর্ডারটি বাতিল করা হয়েছে। কারণ: ${cancelReason}`, true);
      return { success: true, message: `Order cancelled: ${cancelReason}` };
    }

    await this.answerCallbackQuery(id, 'Unknown action', false);
    return { success: false, message: 'Unknown action' };
  },

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

  /**
   * Send a general HTML message to a chat (e.g. group or user)
   */
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
  },

  /**
   * Execute order cancellation with either preset or custom reason
   */
  async executeOrderCancellation(params: {
    orderIdCode: string;
    cancelReason: string;
    workerTelegramId: number;
    workerName: string;
    workerUsername?: string;
    chatId?: string | number;
    messageId?: number;
  }): Promise<{ success: boolean; message: string; order?: Order }> {
    const { orderIdCode, cancelReason, workerTelegramId, workerName, workerUsername, chatId, messageId } = params;

    const existingOrder = await db.getOrderByCode(orderIdCode);
    if (!existingOrder) {
      return { success: false, message: 'অর্ডারটি খুঁজে পাওয়া যায়নি।' };
    }

    if (existingOrder.status === 'CANCELLED') {
      return { success: false, message: 'অর্ডারটি ইতোমধ্যে বাতিল করা হয়েছে।' };
    }

    const assignedWorker = existingOrder.current_worker ||
      existingOrder.assignments?.find(a => ['CLAIMED', 'PROCESSING', 'OUT_FOR_DELIVERY'].includes(a.status))?.worker;
    const assignedTelegramId = assignedWorker?.telegram_user_id;
    const assignedWorkerName = assignedWorker?.full_name || 'অন্য একজন কর্মী';

    // Workers can only cancel the order after claim, not before the claim
    if (!assignedTelegramId || existingOrder.status === 'PENDING_CLAIM' || existingOrder.status === 'PENDING_PAYMENT') {
      return {
        success: false,
        message: 'অর্ডারটি বাতিল করতে হলে প্রথমে এটি ক্লেইম (Claim) করতে হবে।'
      };
    }

    if (assignedTelegramId !== workerTelegramId) {
      return {
        success: false,
        message: `⛔ এই অর্ডারটি [${assignedWorkerName}] ক্লেইম করেছেন। শুধুমাত্র তিনি অথবা অ্যাডমিন এটি বাতিল করতে পারবেন।`
      };
    }

    const updateResult = await db.updateOrderStatus(orderIdCode, 'CANCELLED', {
      workerTelegramId,
      notes: cancelReason
    });

    if (!updateResult.success) {
      return { success: false, message: updateResult.message };
    }

    const order = updateResult.order || existingOrder;
    order.customer_notes = cancelReason;

    // Update Telegram message card in group
    const targetChatId = chatId || env.telegram.workerGroupId;
    const targetMsgId = messageId || order.telegram_message_id;

    if (targetChatId && targetMsgId) {
      const { cardHtml, replyMarkup } = this.generateOrderCard(order, workerName);
      await this.editMessageText(targetChatId, targetMsgId, cardHtml, replyMarkup);

      // Clean up buttons or message from any previous card for this order if different
      if (order.telegram_message_id && order.telegram_message_id !== targetMsgId) {
        try {
          await this.deleteMessage(targetChatId, order.telegram_message_id);
        } catch {
          await this.editMessageReplyMarkup(targetChatId, order.telegram_message_id, { inline_keyboard: [] });
        }
      }
    }

    // Trigger WhatsApp customer notification with custom reason
    whatsappService.sendOrderCancelledNotification(order, cancelReason).catch(err => {
      console.error('[Telegram->WhatsApp Notify Error on Custom Cancel]:', err);
    });

    // Clear pending cancellation state for this worker
    this.clearPendingCancellation(workerTelegramId);

    // Trigger queue to dispatch next order in line
    import('./queue').then(m => m.telegramQueue.processNextInQueue()).catch(err => {
      console.warn('[Telegram Queue Auto-Dispatch Warning on Cancel]:', err);
    });

    return { success: true, message: `Order #${orderIdCode} cancelled: ${cancelReason}`, order };
  },

  /**
   * Handle incoming text messages from workers in the Telegram group
   */
  async handleWorkerTextMessage(message: {
    message_id: number;
    from: { id: number; first_name: string; last_name?: string; username?: string };
    chat: { id: number | string };
    text: string;
    reply_to_message?: { message_id: number; text?: string };
  }): Promise<{ handled: boolean; success?: boolean; message?: string }> {
    const workerId = message.from.id;
    const workerName = [message.from.first_name, message.from.last_name].filter(Boolean).join(' ') || message.from.username || `Worker-${workerId}`;
    const text = message.text.trim();
    const replyText = message.reply_to_message?.text || '';

    // Command: /start or /help
    if (text === '/start' || text === '/help') {
      const helpText = 
`👋 <b>WapBusiness Worker Bot Commands</b>

• <b>/stats</b> - আপনার ডেলিভারি পরিসংখ্যান
• <b>/check &lt;order_id&gt;</b> - অর্ডারের বিস্তারিত ও পেমেন্ট স্ট্যাটাস (Auto-Paid or Manual)
• <b>/gateway</b> - ZiniPay অটো-পেমেন্ট গেটওয়ের বর্তমান অবস্থা
• <b>/cancel &lt;order_id&gt; &lt;reason&gt;</b> - ক্লেইমকৃত অর্ডার বাতিল করুন
• <b>/help</b> - কমান্ড সহায়িকা

💡 <i>গ্রাহক ZiniPay দিয়ে পেমেন্ট করলে গ্রুপে সরাসরি 🟢 <b>[AUTO-PAID]</b> অর্ডার আসে। পেমেন্ট ১০০% নিশ্চিত হওয়ায় ম্যানুয়াল SMS চেক করার প্রয়োজন নেই।</i>`;

      await this.sendMessage(message.chat.id, helpText, { reply_to_message_id: message.message_id });
      return { handled: true, success: true, message: 'Help sent' };
    }

    // Command: /stats
    if (text === '/stats') {
      const workers = await db.getWorkers();
      const worker = workers.find(w => w.telegram_user_id === workerId || (message.from.username && w.telegram_username?.toLowerCase() === message.from.username.toLowerCase()));

      let statsText = '';
      if (worker) {
        statsText = 
`📊 <b>ডেলিভারি পরিসংখ্যান / Worker Stats</b>

👷 <b>কর্মী:</b> <b>${worker.full_name}</b> (@${worker.telegram_username || 'n/a'})
🆔 <b>Telegram ID:</b> <code>${worker.telegram_user_id}</code>
🛡️ <b>ভূমিকা:</b> <code>${worker.role}</code>

⚡ <b>অ্যাক্টিভ ক্লেইম:</b> <b>${worker.active_orders || 0} টি</b>
✅ <b>মোট সম্পন্ন ডেলিভারি:</b> <b>${worker.total_completed_orders || 0} টি</b>

🟢 <i>অর্ডার ক্লেইম করতে নোটিফিকেশন আসলে [⚡ Claim Order] চাপুন।</i>`;
      } else {
        statsText = 
`ℹ️ <b>Worker Profile Status</b>

আপনার Telegram ID (<code>${workerId}</code>) দিয়ে ডাটাবেজে কোনো রেজিস্টার্ড কর্মী প্রোফাইল পাওয়া যায়নি।
গ্রুপে নতুন অর্ডার আসলে <b>[⚡ Claim Order]</b> বাটনে চাপ দিলে আপনার প্রোফাইল স্বয়ংক্রিয়ভাবে সক্রিয় হবে।`;
      }

      await this.sendMessage(message.chat.id, statsText, { reply_to_message_id: message.message_id });
      return { handled: true, success: true, message: 'Stats sent' };
    }

    // Command: /check <order_id_or_invoice_id> or /order <id>
    const checkCmdMatch = text.match(/^\/(?:check|order)(?:\s+([A-Za-z0-9_-]+))?$/i);
    if (checkCmdMatch) {
      let targetCode = checkCmdMatch[1]?.trim();
      if (!targetCode) {
        const replyOrderMatch = replyText.match(/Order ID:\s*([A-Za-z0-9-]+)/i) || replyText.match(/#(WAP-[0-9]+-[0-9]+)/i);
        if (replyOrderMatch) {
          targetCode = replyOrderMatch[1];
        }
      }

      if (!targetCode) {
        await this.sendMessage(
          message.chat.id,
          `⚠️ অনুগ্রহ করে Order ID বা Invoice ID উল্লেখ করুন।\nউদাহরণ: <code>/check WAP-20260923-0001</code> অথবা <code>/check INV-12345</code>`,
          { reply_to_message_id: message.message_id }
        );
        return { handled: true, success: false, message: 'Order ID required' };
      }

      const order = (await db.getOrderByCode(targetCode)) || (await db.getOrderByInvoiceId(targetCode));
      if (!order) {
        await this.sendMessage(
          message.chat.id,
          `❌ <code>${targetCode}</code> দিয়ে কোনো অর্ডার পাওয়া যায়নি। অনুগ্রহ করে সঠিক আইডি চেক করুন।`,
          { reply_to_message_id: message.message_id }
        );
        return { handled: true, success: false, message: 'Order not found' };
      }

      const firstItem = order.items?.[0];
      const gameTitle = order.customer_notes?.match(/Game:\s*([^|\n]+)/i)?.[1]?.trim() || firstItem?.product_name || 'Top-Up Service';
      const playerUid = order.player_uid || (order.delivery_address as any)?.player_uid || (order.delivery_address as any)?.name || 'N/A';
      const isAuto = Boolean(order.invoice_id || order.payment_method?.toUpperCase().includes('ZINIPAY') || order.trx_id?.startsWith('ZINI'));

      const checkReply = 
`🔍 <b>Order Status / অর্ডার বিবরণ</b>

📦 <b>Order ID:</b> <code>${order.order_id}</code>
🕹️ <b>সার্ভিস:</b> <b>${gameTitle}</b>
🆔 <b>Player UID:</b> <code>${playerUid}</code>
💰 <b>মূল্য:</b> ৳${order.total_amount}

🚦 <b>স্ট্যাটাস:</b> <b>${order.status}</b>
💳 <b>পেমেন্ট মাধ্যম:</b> <b>${order.payment_method || 'bKash/Nagad'}</b>
🧾 <b>Invoice ID:</b> <code>${order.invoice_id || 'N/A'}</code>
🔢 <b>TrxID:</b> <code>${order.trx_id || 'N/A'}</code>
⚡ <b>পেমেন্ট টাইপ:</b> ${isAuto ? '🟢 <b>100% Auto-Verified (ZiniPay)</b>' : '🟡 <b>Manual TrxID</b>'}
👷 <b>অ্যাসাইন কর্মী:</b> <b>${order.current_worker?.full_name || 'অ্যাসাইন হয়নি'}</b>
🕒 <b>অর্ডারের তারিখ:</b> ${new Date(order.created_at).toLocaleString()}`;

      await this.sendMessage(message.chat.id, checkReply, { reply_to_message_id: message.message_id });
      return { handled: true, success: true, message: 'Order checked' };
    }

    // Command: /gateway or /zinipay
    if (text === '/gateway' || text === '/zinipay') {
      const isAuto = await db.isZiniPayAutoPaymentEnabled();
      const maskedKey = env.zinipay.apiKey ? `${env.zinipay.apiKey.slice(0, 6)}...${env.zinipay.apiKey.slice(-4)}` : 'Not configured';

      const gatewayReply = 
`💳 <b>ZiniPay Payment Gateway Status</b>

⚙️ <b>Auto-Payment Gateway:</b> ${isAuto ? '🟢 <b>ACTIVE (স্বয়ংক্রিয় পেমেন্ট চালু)</b>' : '🟡 <b>INACTIVE (ম্যানুয়াল মোড)</b>'}
🌐 <b>API URL:</b> <code>${env.zinipay.apiUrl}</code>
🔑 <b>API Key:</b> <code>${maskedKey}</code>

ℹ️ <i>গ্রাহকরা চেকআউট লিংক পেলে পেমেন্ট সম্পন্ন হওয়ামাত্রই টেলিগ্রাম ওয়ার্কার গ্রুপে 🟢 <b>[AUTO-PAID]</b> হিসেবে নোটিফিকেশন চলে আসে।</i>`;

      await this.sendMessage(message.chat.id, gatewayReply, { reply_to_message_id: message.message_id });
      return { handled: true, success: true, message: 'Gateway status sent' };
    }

    // 1. Check for command /cancel [order_id] [reason]
    const cancelCmdMatch = text.match(/^\/cancel(?:\s+([A-Za-z0-9-]+))?(?:\s+(.+))?$/i);
    if (cancelCmdMatch) {
      let targetOrderCode = cancelCmdMatch[1]?.trim();
      let cmdReason = cancelCmdMatch[2]?.trim();

      // If user replied to an order message with "/cancel <reason>"
      if (!targetOrderCode || targetOrderCode.length < 5 || !targetOrderCode.toUpperCase().startsWith('WAP-')) {
        const replyOrderMatch = replyText.match(/Order ID:\s*([A-Za-z0-9-]+)/i) || replyText.match(/#(WAP-[0-9]+-[0-9]+)/i);
        if (replyOrderMatch) {
          cmdReason = [targetOrderCode, cmdReason].filter(Boolean).join(' ');
          targetOrderCode = replyOrderMatch[1];
        }
      }

      // Check if user has an active pending cancellation
      const pending = this.getPendingCancellation(workerId);
      if (!targetOrderCode && pending) {
        targetOrderCode = pending.orderIdCode;
        cmdReason = [cancelCmdMatch[1], cancelCmdMatch[2]].filter(Boolean).join(' ');
      }

      // If worker just typed "/cancel" without any reason
      if (!cmdReason && pending) {
        this.clearPendingCancellation(workerId);
        await this.sendMessage(message.chat.id, `✅ <b>[${workerName}]</b>, #${pending.orderIdCode} অর্ডার বাতিলের প্রক্রিয়া প্রত্যাহার করা হয়েছে।`);
        return { handled: true, success: true, message: 'Cancellation aborted' };
      }

      if (targetOrderCode && cmdReason) {
        const result = await this.executeOrderCancellation({
          orderIdCode: targetOrderCode,
          cancelReason: cmdReason,
          workerTelegramId: workerId,
          workerName,
          workerUsername: message.from.username,
          chatId: message.chat.id,
          messageId: pending?.messageId
        });

        if (result.success) {
          await this.sendMessage(
            message.chat.id,
            `❌ <b>অর্ডার #${targetOrderCode} বাতিল করা হয়েছে</b>\n\n⚠️ <b>কারণ:</b> ${cmdReason}\n👷 <b>কর্মী:</b> <b>${workerName}</b>\n\n<i>কাস্টমারকে হোয়াটসঅ্যাপে বাতিলের কারণ জানানো হয়েছে।</i>`,
            { reply_to_message_id: message.message_id }
          );
        } else {
          await this.sendMessage(
            message.chat.id,
            `⚠️ অর্ডার #${targetOrderCode} বাতিল করা যায়নি: ${result.message}`,
            { reply_to_message_id: message.message_id }
          );
        }
        return { handled: true, ...result };
      }
    }

    // 2. Check for active pending cancellation session
    const pending = this.getPendingCancellation(workerId);
    if (pending) {
      const cancelReason = text;

      const result = await this.executeOrderCancellation({
        orderIdCode: pending.orderIdCode,
        cancelReason,
        workerTelegramId: workerId,
        workerName,
        workerUsername: message.from.username,
        chatId: message.chat.id,
        messageId: pending.messageId
      });

      if (result.success) {
        await this.sendMessage(
          message.chat.id,
          `❌ <b>অর্ডার #${pending.orderIdCode} বাতিল করা হয়েছে</b>\n\n⚠️ <b>কারণ:</b> ${cancelReason}\n👷 <b>কর্মী:</b> <b>${workerName}</b>\n\n<i>কাস্টমারকে হোয়াটসঅ্যাপে বাতিলের কারণ পাঠানো হয়েছে।</i>`,
          { reply_to_message_id: message.message_id }
        );
      } else {
        await this.sendMessage(
          message.chat.id,
          `⚠️ অর্ডার #${pending.orderIdCode} বাতিল করা যায়নি: ${result.message}`,
          { reply_to_message_id: message.message_id }
        );
      }

      return { handled: true, ...result };
    }

    // 3. Check if message is a direct reply to an order card prompt asking for cancellation reason
    const replyOrderMatch = replyText.match(/Order ID:\s*([A-Za-z0-9-]+)/i) || replyText.match(/#(WAP-[0-9]+-[0-9]+)/i);
    if (replyOrderMatch && (replyText.includes('WRITE CANCELLATION REASON') || replyText.includes('বাতিলের কারণ লিখুন'))) {
      const orderIdCode = replyOrderMatch[1];
      const cancelReason = text;

      const result = await this.executeOrderCancellation({
        orderIdCode,
        cancelReason,
        workerTelegramId: workerId,
        workerName,
        workerUsername: message.from.username,
        chatId: message.chat.id,
        messageId: message.reply_to_message?.message_id
      });

      if (result.success) {
        await this.sendMessage(
          message.chat.id,
          `❌ <b>অর্ডার #${orderIdCode} বাতিল করা হয়েছে</b>\n\n⚠️ <b>কারণ:</b> ${cancelReason}\n👷 <b>কর্মী:</b> <b>${workerName}</b>`,
          { reply_to_message_id: message.message_id }
        );
      } else {
        await this.sendMessage(
          message.chat.id,
          `⚠️ অর্ডার বাতিল করা যায়নি: ${result.message}`,
          { reply_to_message_id: message.message_id }
        );
      }

      return { handled: true, ...result };
    }

    return { handled: false };
  },

  /**
   * Handle incoming photo from worker in Telegram (QR Code for PUBG QR Login orders)
   */
  async handleWorkerPhotoMessage(message: {
    message_id: number;
    chat: { id: number | string };
    from: { id: number; first_name: string; last_name?: string; username?: string };
    photo?: Array<{ file_id: string; file_unique_id: string; width: number; height: number; file_size?: number }>;
    caption?: string;
    reply_to_message?: { message_id: number; text?: string; caption?: string };
  }): Promise<{ handled: boolean; success?: boolean; message?: string }> {
    if (!message.photo || message.photo.length === 0) {
      return { handled: false };
    }

    const workerId = message.from.id;
    const workerName = [message.from.first_name, message.from.last_name].filter(Boolean).join(' ') || message.from.username || `Worker-${workerId}`;
    const caption = (message.caption || '').trim();
    const replyText = message.reply_to_message?.text || message.reply_to_message?.caption || '';

    console.log(`[Telegram Photo] Received photo from worker "${workerName}" (${workerId}). Checking for target QR order...`);

    // 1. Identify targeted order
    let targetOrderCode = '';

    // 1a. Check reply text
    const replyMatch = replyText.match(/Order ID:\s*([A-Za-z0-9-]+)/i) || replyText.match(/#(WAP-[0-9]+-[0-9]+|DS-[0-9]+|[A-Za-z0-9-]+)/i);
    if (replyMatch) {
      targetOrderCode = replyMatch[1].replace('#', '');
    }

    // 1b. Check caption (e.g. "#DS-1024" or "DS-1024")
    if (!targetOrderCode && caption) {
      const captionMatch = caption.match(/(?:#)?([A-Za-z0-9-]+)/);
      if (captionMatch) {
        targetOrderCode = captionMatch[1];
      }
    }

    let targetOrder: Order | null = null;
    if (targetOrderCode) {
      targetOrder = await db.getOrderByCode(targetOrderCode);
    }

    // 1c. If no specific order code found, look for active claimed QR order for this worker
    if (!targetOrder) {
      const activeOrders = await db.getOrders({
        status: 'CLAIMED'
      });
      const workerQrOrder = activeOrders.find(o => {
        const isWorkerMatch = o.current_worker?.telegram_user_id === workerId;
        const isQr = (o.customer_notes || '').toLowerCase().includes('pubg_login') ||
                     (o.customer_notes || '').toLowerCase().includes('qr') ||
                     o.items?.some(i => i.product_name.toLowerCase().includes('qr'));
        return isWorkerMatch && isQr;
      });

      if (workerQrOrder) {
        targetOrder = workerQrOrder;
      }
    }

    if (!targetOrder) {
      console.log(`[Telegram Photo] No active QR order matched for worker ${workerName}`);
      return { handled: false };
    }

    // 2. Fetch the highest resolution photo file path from Telegram Bot API
    const bestPhoto = message.photo[message.photo.length - 1];
    const fileId = bestPhoto.file_id;

    try {
      const fileRes = await fetch(`${env.telegram.apiUrl}/getFile?file_id=${fileId}`);
      const fileData = await fileRes.json();

      if (!fileData.ok || !fileData.result?.file_path) {
        await this.sendMessage(
          message.chat.id,
          `⚠️ Telegram থেকে ছবি লোড করা যায়নি: ${fileData.description || 'Unknown error'}`,
          { reply_to_message_id: message.message_id }
        );
        return { handled: true, success: false, message: 'Failed to get file from Telegram' };
      }

      const telegramPhotoUrl = `https://api.telegram.org/file/bot${env.telegram.botToken}/${fileData.result.file_path}`;
      console.log(`[Telegram Photo] Photo URL resolved for Order #${targetOrder.order_id}: ${telegramPhotoUrl}`);

      // 3. Download image buffer and save to Supabase Storage bucket 'order-media'
      let finalImageUrl = telegramPhotoUrl;
      try {
        const photoFetch = await fetch(telegramPhotoUrl);
        if (photoFetch.ok) {
          const buffer = await photoFetch.arrayBuffer();
          const uploadRes = await storageService.uploadImage(
            buffer,
            `qr_${targetOrder.order_id}.jpg`,
            'pubg-qr',
            'image/jpeg'
          );
          if (uploadRes.success && uploadRes.publicUrl) {
            finalImageUrl = uploadRes.publicUrl;
            console.log(`[Telegram Photo] Stored in Supabase Bucket: ${finalImageUrl}`);
          }
        }
      } catch (storageErr) {
        console.warn('[Telegram Photo Supabase Upload Warning]:', storageErr);
      }

      // 4. Send QR Code to customer on WhatsApp with interactive buttons
      const firstItem = targetOrder.items?.[0];
      const sendResult = await whatsappService.sendQrCodePrompt(
        targetOrder.delivery_phone,
        finalImageUrl,
        targetOrder.order_id,
        firstItem?.product_name
      );

      if (!sendResult.success) {
        await this.sendMessage(
          message.chat.id,
          `⚠️ কাস্টমারের WhatsApp-এ QR কোড পাঠানো যায়নি: ${sendResult.error || 'Network error'}`,
          { reply_to_message_id: message.message_id }
        );
        return { handled: true, success: false, message: sendResult.error };
      }

      // 5. Update order notes & status to PROCESSING
      const updatedNotes = `QR Code forwarded to WhatsApp at ${new Date().toLocaleTimeString()} (5m expiry timer) | Storage: ${finalImageUrl}`;
      targetOrder.status = 'PROCESSING';
      targetOrder.customer_notes = `${targetOrder.customer_notes || ''} | ${updatedNotes}`;
      await db.updateOrderStatus(targetOrder.id, 'PROCESSING', {
        notes: updatedNotes
      });

      // 5b. Remove the previous order card message above the screenshot so group stays clean
      const oldMessageId = targetOrder.telegram_message_id;
      if (oldMessageId) {
        try {
          await this.deleteMessage(env.telegram.workerGroupId, oldMessageId);
          console.log(`[Telegram Photo] Cleaned up previous order card message #${oldMessageId} for Order #${targetOrder.order_id}`);
        } catch (delErr) {
          console.warn('[Telegram Photo] Could not delete old order card:', delErr);
          await this.editMessageReplyMarkup(env.telegram.workerGroupId, oldMessageId, { inline_keyboard: [] });
        }
      }

      // 6. Post the new active order card directly below the worker's screenshot with the action buttons
      const { cardHtml, replyMarkup } = this.generateOrderCard(targetOrder, workerName);
      const postCardText = 
`✅ <b>QR কোড কাস্টমারের WhatsApp-এ সফলভাবে পাঠানো হয়েছে!</b>

${cardHtml}`;

      const sendRes = await this.sendMessage(
        message.chat.id,
        postCardText,
        {
          reply_to_message_id: message.message_id,
          reply_markup: replyMarkup
        }
      );

      if (sendRes.ok && sendRes.result?.message_id) {
        targetOrder.telegram_message_id = sendRes.result.message_id;
        await db.updateOrderTelegramMessageId(targetOrder.id, sendRes.result.message_id);
      }

      return { handled: true, success: true };
    } catch (err) {
      console.error('[Telegram handleWorkerPhotoMessage Exception]:', err);
      await this.sendMessage(
        message.chat.id,
        `⚠️ QR কোড প্রসেস করতে ত্রুটি: ${String(err)}`,
        { reply_to_message_id: message.message_id }
      );
      return { handled: true, success: false, message: String(err) };
    }
  },

  /**
   * Notify worker in Telegram when customer clicks "QR Done" or "Need New QR" on WhatsApp
   */
  async notifyWorkerQrAction(orderIdCode: string, action: 'SCANNED' | 'REFRESH_REQUESTED'): Promise<void> {
    if (!env.telegram.isConfigured) return;

    const order = await db.getOrderByCode(orderIdCode);
    if (!order) return;

    const workerName = order.current_worker?.full_name || 'Worker';

    if (action === 'SCANNED') {
      order.status = 'PROCESSING';
      order.customer_notes = `${order.customer_notes || ''} | Customer Scanned QR`;
      await db.updateOrderStatus(order.id, 'PROCESSING', {
        notes: 'Customer Scanned QR'
      });

      // Remove the previous card so there are never duplicate messages with buttons
      const prevMsgId = order.telegram_message_id;
      if (prevMsgId) {
        try {
          await this.deleteMessage(env.telegram.workerGroupId, prevMsgId);
          console.log(`[Telegram Scanned Sync] Deleted previous order card #${prevMsgId} for Order #${order.order_id}`);
        } catch (delErr) {
          console.warn('[Telegram Scanned Sync] Failed to delete previous card:', delErr);
          await this.editMessageReplyMarkup(env.telegram.workerGroupId, prevMsgId, { inline_keyboard: [] });
        }
      }

      const { cardHtml, replyMarkup } = this.generateOrderCard(order, workerName);
      const msg = 
`🎯 <b>[Order #${order.order_id}] CUSTOMER SCANNED QR CODE! / স্ক্যান সম্পন্ন</b>

${cardHtml}`;

      const sendRes = await this.sendMessage(env.telegram.workerGroupId, msg, { reply_markup: sanitizeReplyMarkup(replyMarkup) });
      if (sendRes.ok && sendRes.result?.message_id) {
        order.telegram_message_id = sendRes.result.message_id;
        await db.updateOrderTelegramMessageId(order.id, sendRes.result.message_id);
      }
    } else if (action === 'REFRESH_REQUESTED') {
      const prevMsgId = order.telegram_message_id;
      if (prevMsgId) {
        // Strip buttons from previous card so worker cannot click them while expired
        await this.editMessageReplyMarkup(env.telegram.workerGroupId, prevMsgId, { inline_keyboard: [] }).catch(() => {});
      }

      const msg = 
`⚠️ <b>[Order #${order.order_id}] CUSTOMER REQUESTED NEW QR! / নতুন কিউআর প্রয়োজন</b>

👷 <b>Worker:</b> <b>${workerName}</b>
📱 <b>Customer:</b> <code>${order.delivery_phone}</code>
⏱️ <b>কারণ:</b> পূর্বের QR কোডের ৫ মিনিট মেয়াদ শেষ হয়ে গেছে বা স্ক্যান হয়নি।

📸 <b>একশন:</b> দয়া করে দ্রুত একটি <b>নতুন Login QR কোড স্ক্রিনশট</b> এই গ্রুপে পাঠান (Reply to Order)।`;

      const sendRes = await this.sendMessage(env.telegram.workerGroupId, msg);
      if (sendRes.ok && sendRes.result?.message_id) {
        order.telegram_message_id = sendRes.result.message_id;
        await db.updateOrderTelegramMessageId(order.id, sendRes.result.message_id);
      }
    }
  },

  /**
   * Notify worker in Telegram when customer sends the email verification code on WhatsApp
   * (PUBG KR / eFootball "code method" fulfillment)
   */
  async notifyWorkerCodeReceived(orderIdCode: string, code: string): Promise<void> {
    if (!env.telegram.isConfigured) return;

    const order = await db.getOrderByCode(orderIdCode);
    if (!order) return;

    const workerName = order.current_worker?.full_name || 'Worker';

    const updatedNotes = `${order.customer_notes || ''} | CODE_RECEIVED:${code}`;
    await db.updateOrderStatus(order.order_id, order.status, { notes: updatedNotes });

    const refreshedOrder = (await db.getOrderByCode(order.order_id)) || order;

    // Remove the previous card so there are never duplicate messages with buttons
    const prevMsgId = refreshedOrder.telegram_message_id;
    if (prevMsgId) {
      try {
        await this.deleteMessage(env.telegram.workerGroupId, prevMsgId);
        console.log(`[Telegram Code Received] Deleted previous order card #${prevMsgId} for Order #${refreshedOrder.order_id}`);
      } catch (delErr) {
        console.warn('[Telegram Code Received] Failed to delete previous card:', delErr);
        await this.editMessageReplyMarkup(env.telegram.workerGroupId, prevMsgId, { inline_keyboard: [] });
      }
    }

    const { cardHtml, replyMarkup } = this.generateOrderCard(refreshedOrder, workerName);
    const msg =
`📨 <b>[Order #${refreshedOrder.order_id}] CUSTOMER SENT CODE! / কাস্টমার কোড পাঠিয়েছেন</b>

🔑 <b>Code:</b> <code>${code}</code>

${cardHtml}`;

    const sendRes = await this.sendMessage(env.telegram.workerGroupId, msg, { reply_markup: sanitizeReplyMarkup(replyMarkup) });
    if (sendRes.ok && sendRes.result?.message_id) {
      refreshedOrder.telegram_message_id = sendRes.result.message_id;
      await db.updateOrderTelegramMessageId(refreshedOrder.id, sendRes.result.message_id);
    }
  }
};
