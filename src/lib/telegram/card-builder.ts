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

const pendingWorkerCancellations = new Map<number, PendingWorkerCancellation>();

export const cancellationStore = {
  setPendingCancellation(workerTelegramId: number, data: Omit<PendingWorkerCancellation, 'createdAt'>) {
    pendingWorkerCancellations.set(workerTelegramId, { ...data, createdAt: Date.now() });
  },

  getPendingCancellation(workerTelegramId: number): PendingWorkerCancellation | undefined {
    const pending = pendingWorkerCancellations.get(workerTelegramId);
    if (!pending) return undefined;
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
  if (reasonCodeOrText === 'fake_trxid') return 'Fake or Invalid TrxID (পেমেন্ট মেলেনি)';
  if (reasonCodeOrText === 'refund_needed') return 'Refund Needed (অটো-পেইড অর্ডার / গ্রাহককে রিফান্ড প্রযোজ্য)';
  if (reasonCodeOrText === 'stock_out') return 'Out of Stock / Server Error (স্টক শেষ)';
  if (reasonCodeOrText === 'customer_req') return 'Customer Requested (গ্রাহকের অনুরোধ)';
  return reasonCodeOrText;
}

export function sanitizeReplyMarkup(markup?: any): any {
  if (!markup || !markup.inline_keyboard || !Array.isArray(markup.inline_keyboard)) return markup;
  const newKeyboard = markup.inline_keyboard.map((row: any[]) =>
    Array.isArray(row)
      ? row.map((btn: any) => {
          if (btn && typeof btn.callback_data === 'string' && Buffer.byteLength(btn.callback_data, 'utf8') > 64) {
            console.error(`[Telegram Warning] callback_data exceeds 64 bytes: "${btn.callback_data}"`);
            let truncated = btn.callback_data;
            while (Buffer.byteLength(truncated, 'utf8') > 64) truncated = truncated.slice(0, -1);
            return { ...btn, callback_data: truncated };
          }
          return btn;
        })
      : row
  );
  return { ...markup, inline_keyboard: newKeyboard };
}

export function isQrLoginOrder(order: { customer_notes?: string; items?: Array<{ product_name?: string }> }): boolean {
  const firstItem = order.items?.[0];
  const gameTitle = order.customer_notes?.match(/Game:\s*([^|\n]+)/i)?.[1]?.trim() || firstItem?.product_name || '';
  const combined = `${gameTitle} ${firstItem?.product_name || ''} ${order.customer_notes || ''}`.toLowerCase();
  if (combined.includes('pubg_kr') || combined.includes('korean') || combined.includes('kr uc') ||
      combined.includes('efootball') || combined.includes('efb') || combined.includes('konami')) return false;
  return combined.includes('qr') || combined.includes('pubg_login') || combined.includes('login uc');
}

export function hasQrCodeBeenSent(order: { customer_notes?: string; status?: string }): boolean {
  const notes = order.customer_notes || '';
  const lastForwardIdx = notes.lastIndexOf('QR Code forwarded');
  const lastRefreshIdx = notes.lastIndexOf('QR_REFRESH_REQUESTED');
  if (lastRefreshIdx !== -1 && lastRefreshIdx > lastForwardIdx) return false;
  return notes.includes('QR Code forwarded') || notes.includes('Storage:') ||
    notes.includes('Customer Scanned') || notes.includes('QR_SCANNED') ||
    order.status === 'PROCESSING' || order.status === 'DELIVERED';
}

// ─── Button shorthand helpers ───
type BtnRow = Array<{ text: string; callback_data: string }>;
const btn = (text: string, data: string) => ({ text, callback_data: data });
const completedBtn = (id: string): BtnRow => [btn('✅ Order Completed', `status_delivered:${id}`)];
const cancelBtn = (id: string): BtnRow => [btn('❌ Cancel Order', `cancel_prompt:${id}`)];
const claimBtn = (id: string): BtnRow => [btn('⚡ Claim Order', `claim:${id}`)];
const DIV = '\n─────────────────\n';

export function generateOrderCard(
  order: Order,
  assignedWorkerName?: string,
  queueCount?: number
): { cardHtml: string; replyMarkup: { inline_keyboard: BtnRow[] } } {
  // ── Data extraction ──
  const firstItem = order.items?.[0];
  const itemsText = order.items
    ?.map(item => `  ▪️ <b>${item.product_name}</b> × ${item.quantity} = ৳${item.subtotal}`)
    .join('\n') || '  ▪️ No item details';

  const gameTitle = order.customer_notes?.match(/Game:\s*([^|\n]+)/i)?.[1]?.trim() || firstItem?.product_name || 'Top-Up Service';
  const workerName = assignedWorkerName || order.current_worker?.full_name || 'Worker';

  const playerUid =
    order.player_uid ||
    (order.delivery_address as any)?.player_uid ||
    (order.delivery_address as any)?.name ||
    order.delivery_address?.address?.match(/(?:UID|Player UID|Email|ID):\s*([0-9a-zA-Z@._+-]+)/i)?.[1] ||
    order.customer_notes?.match(/(?:PUBG UID|UID|Player UID|Email|Account):\s*([0-9a-zA-Z@._+-]+)/i)?.[1] ||
    'N/A';

  const playerName = order.customer_notes?.match(/PlayerName:\s*([^|\n]+)/i)?.[1]?.trim() || '';
  const password = order.customer_notes?.match(/Password:\s*([^|\n]+)/i)?.[1]?.trim() || (order.delivery_address as any)?.password || '';

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

  const invoiceId = order.invoice_id || (order.delivery_address as any)?.invoice_id || order.customer_notes?.match(/Invoice:\s*([a-zA-Z0-9_-]+)/i)?.[1] || '';
  const accountInfo = getAccountFieldInfo(playerUid, gameTitle);
  const { methodLabel, proofLines, isAutoVerified } = formatPaymentDisplayForTelegram(trxId, paymentMethod, invoiceId);

  const rawNotes = (order.customer_notes || '').trim();
  const isInternalNote = rawNotes.startsWith('State Bot Order') || rawNotes.startsWith('Payment Verified') || rawNotes.startsWith('Kokos Auto') || rawNotes.startsWith('Pinex Auto') || rawNotes.startsWith('QR Code forwarded') || rawNotes === 'None';

  // ── Detections ──
  const combinedGameStr = `${gameTitle} ${firstItem?.product_name || ''} ${order.customer_notes || ''}`.toLowerCase();
  const isQrOrder = isQrLoginOrder(order);
  const hasQrSent = hasQrCodeBeenSent(order);
  const hasQrScanned = (order.customer_notes || '').includes('Customer Scanned') || (order.customer_notes || '').includes('QR_SCANNED');

  const isCodeOrder = combinedGameStr.includes('korean') || combinedGameStr.includes('pubg_kr') || combinedGameStr.includes('kr uc') || combinedGameStr.includes('efootball') || combinedGameStr.includes('efb') || combinedGameStr.includes('konami');
  const codeNotes = order.customer_notes || '';
  const lastCodeRequestIdx = codeNotes.lastIndexOf('CODE_REQUESTED');
  const lastCodeReceivedIdx = codeNotes.lastIndexOf('CODE_RECEIVED:');
  const hasCodeRequested = lastCodeRequestIdx !== -1;
  const hasCodeReceived = lastCodeReceivedIdx !== -1 && lastCodeReceivedIdx > lastCodeRequestIdx;
  const receivedCode = hasCodeReceived ? (codeNotes.slice(lastCodeReceivedIdx).match(/CODE_RECEIVED:\s*([^|]+)/i)?.[1] || '').trim() : '';

  const isNetflix = combinedGameStr.includes('netflix');
  const isYouTube = combinedGameStr.includes('youtube');
  const isCrunchyroll = combinedGameStr.includes('crunchyroll');

  const netflixNotes = order.customer_notes || '';
  const hasNetflixCredsSent = netflixNotes.includes('NETFLIX_CREDS_SENT');
  const lastNetflixCodeReqIdx = netflixNotes.lastIndexOf('NETFLIX_CODE_REQUESTED');
  const lastNetflixCodeSentIdx = netflixNotes.lastIndexOf('NETFLIX_CODE_SENT');
  const hasNetflixCodeRequested = lastNetflixCodeReqIdx !== -1 && (lastNetflixCodeSentIdx === -1 || lastNetflixCodeReqIdx > lastNetflixCodeSentIdx);
  const hasNetflixLoginDone = netflixNotes.includes('NETFLIX_LOGIN_DONE');

  const crunchyrollNotes = order.customer_notes || '';
  const hasCrunchyrollCredsSent = crunchyrollNotes.includes('CRUNCHYROLL_CREDS_SENT');
  const hasCrunchyrollLoginDone = crunchyrollNotes.includes('CRUNCHYROLL_LOGIN_DONE');
  const crunchyrollCredEmail = crunchyrollNotes.match(/Email:\s*([^\s|]+)/i)?.[1] || '';
  const crunchyrollCredPass = crunchyrollNotes.match(/Pass:\s*([^\s|]+)/i)?.[1] || '';
  const crunchyrollCredProfile = crunchyrollNotes.match(/Profile:\s*([^|]+)/i)?.[1]?.trim() || '';

  const netflixCredEmail = netflixNotes.match(/Email:\s*([^\s|]+)/i)?.[1] || '';
  const netflixCredPass = netflixNotes.match(/Pass:\s*([^\s|]+)/i)?.[1] || '';
  const netflixCredPin = netflixNotes.match(/PIN:\s*([^\s|]+)/i)?.[1] || '';
  const netflixCredProfile = netflixNotes.match(/Profile:\s*([^|]+)/i)?.[1]?.trim() || '';
  const netflixCodeSent = netflixNotes.match(/NETFLIX_CODE_SENT:\s*([^\s|]+)/i)?.[1] || '';

  // ── Reusable layout blocks ──

  // TOP: Static order facts + worker attribution
  const orderBlock = (workerLabel?: string) => {
    const lines: string[] = [
      `📦 <b>Order:</b> <code>${order.order_id}</code>`,
      `🕹️ <b>Service:</b> ${gameTitle}`,
      `💰 <b>Total:</b> ৳${order.total_amount}`,
      `💳 <b>Payment:</b> ${methodLabel}`,
    ];
    if (proofLines) lines.push(proofLines);
    if (workerLabel) lines.push(`👷 <b>${workerLabel}:</b> ${workerName}`);
    return lines.join('\n');
  };

  // BOTTOM: Package, customer details, creds, and other dynamic data
  const customerBlock = (extraLines?: string[]) => {
    const lines: string[] = [];
    lines.push(`💎 <b>Package:</b>\n${itemsText}`);
    lines.push(`📞 <b>Phone:</b> <code>${order.delivery_phone}</code>`);
    lines.push(`${accountInfo.emoji} <b>${accountInfo.labelEn}:</b> <code>${playerUid}</code>`);
    if (playerName) lines.push(`👤 <b>Player Name:</b> ${playerName}`);
    if (password) lines.push(`🔐 <b>Password:</b> <code>${password}</code>`);
    if (extraLines) lines.push(...extraLines);
    if (!isInternalNote && rawNotes) lines.push(`📝 <b>Notes:</b> ${rawNotes}`);
    return lines.join('\n');
  };

  const nfCredsLines = (): string[] => {
    const l: string[] = [];
    if (netflixCredEmail) l.push(`📧 <b>Email:</b> <code>${netflixCredEmail}</code>`);
    if (netflixCredPass) l.push(`🔐 <b>Pass:</b> <code>${netflixCredPass}</code>`);
    if (netflixCredProfile) l.push(`👤 <b>Profile:</b> <code>${netflixCredProfile}</code>`);
    if (netflixCredPin) l.push(`📌 <b>PIN:</b> <code>${netflixCredPin}</code>`);
    if (netflixCodeSent) l.push(`🔑 <b>Code:</b> <code>${netflixCodeSent}</code>`);
    return l;
  };

  const crCredsLines = (): string[] => {
    const l: string[] = [];
    if (crunchyrollCredEmail) l.push(`📧 <b>Email:</b> <code>${crunchyrollCredEmail}</code>`);
    if (crunchyrollCredPass) l.push(`🔐 <b>Pass:</b> <code>${crunchyrollCredPass}</code>`);
    if (crunchyrollCredProfile) l.push(`👤 <b>Profile:</b> <code>${crunchyrollCredProfile}</code>`);
    return l;
  };

  const card = (title: string, banner: string, oBlock: string, cBlock: string, footer?: string) =>
    `${title}${banner}\n${oBlock}${DIV}${cBlock}${footer ? `\n\n${footer}` : ''}`;

  const oid = order.order_id;

  // ══════════════════════════════════════════════
  // CLAIMED / PROCESSING
  // ══════════════════════════════════════════════
  if (order.status === 'CLAIMED' || order.status === 'PROCESSING') {

    // ── Crunchyroll ──
    if (isCrunchyroll) {
      const crBanner = '\n🍥 <b>[CRUNCHYROLL]</b>\n';
      const creds = crCredsLines();
      if (hasCrunchyrollLoginDone) {
        return {
          cardHtml: card('🎉 <b>CUSTOMER CONFIRMED CRUNCHYROLL LOGIN!</b>', crBanner,
            orderBlock('Worker'), customerBlock(creds),
            '✅ কাস্টমার লগইন সম্পন্ন করেছেন! নিচের বাটনে চাপ দিন।'),
          replyMarkup: { inline_keyboard: [completedBtn(oid), cancelBtn(oid)] }
        };
      }
      if (hasCrunchyrollCredsSent) {
        return {
          cardHtml: card('📤 <b>CRUNCHYROLL CREDENTIALS DELIVERED</b>', crBanner,
            orderBlock('Worker'), customerBlock(creds),
            '✅ WhatsApp-এ অ্যাকাউন্ট পাঠানো হয়েছে। কাস্টমার লগইন করলে নোটিফিকেশন আসবে।'),
          replyMarkup: { inline_keyboard: [
            [btn('🔑 Resend Account', `crunchyroll_creds_hint:${oid}`), btn('✅ Completed', `status_delivered:${oid}`)],
            cancelBtn(oid)
          ]}
        };
      }
      return {
        cardHtml: card('🍥 <b>CRUNCHYROLL — SEND ACCOUNT INFO</b>', crBanner,
          orderBlock('Worker'), customerBlock(),
          `🔑 <b>ACTION:</b> রিপ্লাই করে Email ও Password পাঠান।\n<code>user@crunchyroll.com\npass123</code>`),
        replyMarkup: { inline_keyboard: [
          [btn('🔑 Send Account Info', `crunchyroll_creds_hint:${oid}`)],
          cancelBtn(oid)
        ]}
      };
    }

    // ── YouTube ──
    if (isYouTube) {
      const ytBanner = '\n▶️ <b>[YOUTUBE PREMIUM]</b>\n';
      return {
        cardHtml: card('▶️ <b>YOUTUBE ORDER CLAIMED</b>', ytBanner,
          orderBlock('Worker'), customerBlock([`📧 <b>YouTube Email:</b> <code>${playerUid}</code>`]),
          `👉 কাস্টমারের ইমেইলে YouTube Premium ইনভাইট পাঠিয়ে Completed চাপুন।`),
        replyMarkup: { inline_keyboard: [completedBtn(oid), cancelBtn(oid)] }
      };
    }

    // ── Netflix ──
    if (isNetflix) {
      const nfBanner = '\n🍿 <b>[NETFLIX]</b>\n';
      const creds = nfCredsLines();
      if (hasNetflixLoginDone) {
        return {
          cardHtml: card('🎉 <b>CUSTOMER CONFIRMED NETFLIX LOGIN!</b>', nfBanner,
            orderBlock('Worker'), customerBlock(creds),
            '✅ কাস্টমার লগইন সম্পন্ন করেছেন! নিচের বাটনে চাপ দিন।'),
          replyMarkup: { inline_keyboard: [completedBtn(oid), cancelBtn(oid)] }
        };
      }
      if (hasNetflixCodeRequested) {
        return {
          cardHtml: card('🔔 <b>CUSTOMER REQUESTED NETFLIX CODE!</b>', nfBanner,
            orderBlock('Worker'), customerBlock(creds),
            '⏳ কাস্টমার কোড চেয়েছেন! রিপ্লাই করে কোড পাঠান (যেমন: <code>482910</code>)'),
          replyMarkup: { inline_keyboard: [
            [btn('📤 Send Code', `netflix_code_hint:${oid}`)],
            completedBtn(oid), cancelBtn(oid)
          ]}
        };
      }
      if (hasNetflixCredsSent) {
        return {
          cardHtml: card('📤 <b>NETFLIX CREDENTIALS DELIVERED</b>', nfBanner,
            orderBlock('Worker'), customerBlock(creds),
            '✅ WhatsApp-এ অ্যাকাউন্ট পাঠানো হয়েছে। কোড চাইলে নোটিফিকেশন আসবে।'),
          replyMarkup: { inline_keyboard: [
            [btn('🔑 Resend Account', `netflix_creds_hint:${oid}`), btn('📤 Send Code', `netflix_code_hint:${oid}`)],
            completedBtn(oid), cancelBtn(oid)
          ]}
        };
      }
      return {
        cardHtml: card('🍿 <b>NETFLIX — SEND ACCOUNT INFO</b>', nfBanner,
          orderBlock('Worker'), customerBlock(),
          `🔑 <b>ACTION:</b> রিপ্লাই করে Email, Password ও PIN পাঠান।\n<code>user@netflix.com\npass123\n1234</code>`),
        replyMarkup: { inline_keyboard: [
          [btn('🔑 Send Account Info', `netflix_creds_hint:${oid}`)],
          cancelBtn(oid)
        ]}
      };
    }

    // ── QR Login ──
    if (isQrOrder) {
      const qrBanner = '\n📲 <b>[QR LOGIN ORDER]</b>\n';
      if (hasQrScanned) {
        return {
          cardHtml: card('🎯 <b>CUSTOMER SCANNED QR!</b>', qrBanner,
            orderBlock('Worker'), customerBlock(),
            '✅ গ্রাহক QR স্ক্যান করেছেন! Midasbuy-তে টপ-আপ করে Completed চাপুন।'),
          replyMarkup: { inline_keyboard: [completedBtn(oid), cancelBtn(oid)] }
        };
      }
      if (hasQrSent) {
        return {
          cardHtml: card('📤 <b>QR CODE SENT TO WHATSAPP</b>', qrBanner,
            orderBlock('Worker'), customerBlock(),
            '⏱️ ৫ মিনিট কাউন্টডাউন। গ্রাহক স্ক্যান করলে আপডেট আসবে।'),
          replyMarkup: { inline_keyboard: [
            [btn('⏳ Waiting for Scan', `qr_waiting:${oid}`)],
            [btn('🔄 Resend QR', `qr_resend_hint:${oid}`), btn('✅ Completed', `status_delivered:${oid}`)],
            cancelBtn(oid)
          ]}
        };
      }
      return {
        cardHtml: card('✅ <b>QR ORDER CLAIMED — SEND QR CODE</b>', qrBanner,
          orderBlock('Worker'), customerBlock(),
          '📸 <b>ACTION:</b> রিপ্লাই করে Login QR কোডের স্ক্রিনশট পাঠান।'),
        replyMarkup: { inline_keyboard: [
          [btn('📸 Send QR Screenshot', `qr_hint:${oid}`)],
          cancelBtn(oid)
        ]}
      };
    }

    // ── Code Method (PUBG KR / eFootball) ──
    if (isCodeOrder) {
      const codeBanner = '\n📧 <b>[EMAIL CODE VERIFICATION]</b>\n';
      if (hasCodeReceived) {
        return {
          cardHtml: card('🔑 <b>CODE RECEIVED FROM CUSTOMER!</b>', codeBanner,
            orderBlock('Worker'),
            customerBlock([`🔑 <b>Code:</b> <code>${receivedCode || 'N/A'}</code>`]),
            '✅ কোড দিয়ে সাইটে ভেরিফাই করুন। সফল হলে Completed, ব্যর্থ হলে Code Expired চাপুন।'),
          replyMarkup: { inline_keyboard: [
            completedBtn(oid),
            [btn('🔄 Code Expired', `code_request:${oid}`)],
            cancelBtn(oid)
          ]}
        };
      }
      if (hasCodeRequested) {
        return {
          cardHtml: card('📧 <b>CODE REQUESTED — WAITING</b>', codeBanner,
            orderBlock('Worker'), customerBlock(),
            '⏳ কাস্টমারকে কোড দিতে বলা হয়েছে। কোড পাঠালে এখানে আপডেট আসবে।'),
          replyMarkup: { inline_keyboard: [
            [btn('🔄 Resend Request', `code_request:${oid}`)],
            completedBtn(oid), cancelBtn(oid)
          ]}
        };
      }
      return {
        cardHtml: card('✅ <b>CODE ORDER CLAIMED — REQUEST CODE</b>', codeBanner,
          orderBlock('Worker'), customerBlock(),
          '📧 <b>ACTION:</b> নিচের বাটনে চাপ দিয়ে কাস্টমারকে ভেরিফিকেশন কোড দিতে বলুন।'),
        replyMarkup: { inline_keyboard: [
          [btn('📧 Request Code', `code_request:${oid}`)],
          cancelBtn(oid)
        ]}
      };
    }

    // ── Generic Claimed ──
    const claimedTitle = isAutoVerified ? '✅ <b>ORDER CLAIMED [AUTO-PAID]</b>' : '✅ <b>ORDER CLAIMED</b>';
    return {
      cardHtml: card(claimedTitle, '',
        orderBlock('Worker'), customerBlock(),
        '<i>Process the order and click below when complete:</i>'),
      replyMarkup: { inline_keyboard: [completedBtn(oid), cancelBtn(oid)] }
    };
  }

  // ══════════════════════════════════════════════
  // OUT_FOR_DELIVERY / PROCESSING
  // ══════════════════════════════════════════════
  if (order.status === 'OUT_FOR_DELIVERY') {
    const title = isAutoVerified ? '⚡ <b>PROCESSING [AUTO-PAID]</b>' : '⚡ <b>PROCESSING</b>';
    return {
      cardHtml: card(title, '',
        orderBlock('Worker'), customerBlock(),
        '<i>Click below once completed:</i>'),
      replyMarkup: { inline_keyboard: [completedBtn(oid), cancelBtn(oid)] }
    };
  }

  // ══════════════════════════════════════════════
  // DELIVERED
  // ══════════════════════════════════════════════
  if (order.status === 'DELIVERED') {
    const isCrunchyrollAutoDelivered = isCrunchyroll && hasCrunchyrollCredsSent;
    const title = isCrunchyrollAutoDelivered
      ? '🤖 <b>AUTO-DELIVERED & COMPLETED</b>'
      : isAutoVerified ? '🎉 <b>ORDER COMPLETED [AUTO-PAID]</b>' : '🎉 <b>ORDER COMPLETED</b>';
    const deliveredBanner = isCrunchyrollAutoDelivered ? '\n🍥 <b>[CRUNCHYROLL — AUTO-DELIVERED]</b>\n' : '';
    return {
      cardHtml: card(title, deliveredBanner,
        isCrunchyrollAutoDelivered ? orderBlock() : orderBlock('Processed by'),
        isCrunchyrollAutoDelivered ? customerBlock(crCredsLines()) : customerBlock(),
        `🕒 <b>Completed:</b> ${new Date().toLocaleTimeString()}`),
      replyMarkup: { inline_keyboard: [] }
    };
  }

  // ══════════════════════════════════════════════
  // CANCELLED
  // ══════════════════════════════════════════════
  if (order.status === 'CANCELLED') {
    let cancelReason = 'No reason provided';
    if (order.customer_notes && !order.customer_notes.match(/^(?:PUBG UID|Free Fire UID|UID|Player UID|Account|Email|State Bot Order):/i)) {
      cancelReason = order.customer_notes;
    }
    const refundNotice = isAutoVerified ? '\n💸 <b>Refund:</b> অটো-পেইড অর্ডার — অ্যাডমিন প্যানেল থেকে রিফান্ড প্রদান করুন।' : '';
    return {
      cardHtml: card('❌ <b>ORDER CANCELLED</b>', '',
        orderBlock('Handled by'),
        customerBlock([
          `⚠️ <b>Reason:</b> ${cancelReason}${refundNotice}`
        ]),
        `🕒 <b>Cancelled:</b> ${new Date().toLocaleTimeString()}\n<i>⚠️ This order is cancelled. No further action needed.</i>`),
      replyMarkup: { inline_keyboard: [] }
    };
  }

  // ══════════════════════════════════════════════
  // PENDING_CLAIM — Streaming preset auto-delivered (Netflix/Crunchyroll needs OTP claim)
  // Show ONLY the Claim button; action buttons appear after claiming.
  // ══════════════════════════════════════════════
  if (order.status === 'PENDING_CLAIM' && ((isNetflix && hasNetflixCredsSent) || (isCrunchyroll && hasCrunchyrollCredsSent))) {
    const presetBanner = isNetflix ? '\n🍿 <b>[NETFLIX — AUTO-DELIVERED]</b>\n' : '\n🍥 <b>[CRUNCHYROLL — AUTO-DELIVERED]</b>\n';
    const creds = isNetflix ? nfCredsLines() : crCredsLines();
    return {
      cardHtml: card('🤖 <b>AUTO-DELIVERED — CLAIM FOR OTP SUPPORT</b>', presetBanner,
        orderBlock(), customerBlock(creds),
        '⚡ অ্যাকাউন্ট WhatsApp-এ পাঠানো হয়েছে। OTP/কোড সহায়তার জন্য Claim করুন।'),
      replyMarkup: { inline_keyboard: [claimBtn(oid)] }
    };
  }

  // ══════════════════════════════════════════════
  // DEFAULT: PENDING_CLAIM / PENDING_PAYMENT (new order)
  // ══════════════════════════════════════════════
  const queueBadge = queueCount && queueCount > 0 ? `\n📬 <b>Queue:</b> ${queueCount} more order${queueCount > 1 ? 's' : ''} waiting` : '';
  const title = isAutoVerified ? '🟢 <b>NEW ORDER [AUTO-PAID]</b>' : '🚨 <b>NEW ORDER</b>';
  const banner = isQrOrder ? '\n📲 <b>[QR LOGIN ORDER]</b>' : isCodeOrder ? '\n📧 <b>[CODE VERIFICATION]</b>' : '';

  return {
    cardHtml: card(title, banner,
      orderBlock(), customerBlock(),
      `${queueBadge}\n<i>Click below to claim and process:</i>`),
    replyMarkup: { inline_keyboard: [claimBtn(oid)] }
  };
}
