/**
 * Helpers for parsing, cleaning and formatting user inputs from WhatsApp & Telegram
 * (e.g. Player UID, Email Accounts, Game IDs, TrxIDs, Last 4 digits, Payment methods, Bangla numerals)
 */

/**
 * Convert Bengali digits (০-৯) to English digits (0-9)
 */
export function convertBengaliDigits(text: string): string {
  if (!text) return '';
  const bnToEnMap: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
  };
  return text.replace(/[০-৯]/g, d => bnToEnMap[d] || d);
}

/**
 * Extract clean, trimmed Player UID / Email Account / Phone / Game ID based on game category
 */
export function extractCleanUid(rawText: string, gameLabelOrCode?: string): string {
  if (!rawText) return '';
  const converted = convertBengaliDigits(rawText.trim());
  const game = (gameLabelOrCode || '').toLowerCase();

  // 0. Explicit check for Refusal, Cancellation, Menu, Pleasantry, Price Inquiry triggers
  if (
    isRefusalOrCancellation(rawText) || 
    isRefusalOrCancellation(converted) ||
    isGreetingOrMenu(rawText) || 
    isGreetingOrMenu(converted) || 
    isGratitudeOrPleasantry(rawText) ||
    isPriceInquiry(rawText)
  ) {
    return '';
  }

  // 1. Email validation (For Movie/Anime/Netflix/Spotify/Prime/YouTube/Konami)
  const isEmailService = game.includes('movie') || game.includes('netflix') || game.includes('spotify') || 
                         game.includes('prime') || game.includes('crunchyroll') || game.includes('youtube') ||
                         game.includes('efb') || game.includes('efootball') || game.includes('konami');

  const emailMatch = converted.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    return emailMatch[0].trim();
  }
  if (isEmailService && !emailMatch) {
    const isKonamiGame = game.includes('efb') || game.includes('efootball') || game.includes('konami');
    if (isKonamiGame) {
      const tokens = converted.split(/\s+/).filter(Boolean);
      if (tokens.length === 1 && /^[a-zA-Z0-9_-]{4,25}$/.test(tokens[0]) && !isRefusalOrCancellation(tokens[0])) {
        return tokens[0];
      }
    }
    return ''; // Strictly require valid email for movie/OTT subscriptions
  }

  // 2. Check if matches key-value prefix like "UID: 123456", "Player ID 123456", "ID: 123456", "আমার আইডি: 123456"
  const prefixMatch = converted.match(
    /(?:player\s*uid|player\s*id|playerid|uid|id|account|acc|user\s*id|email|gmail|আইডি|ইউআইডি|প্লেয়ার\s*আইডি|প্লেয়ার\s*আইডি|ইমেইল|জিমেইল)[\s:=#\-_]+([^\s,;()\[\]{}]+)/i
  );
  if (prefixMatch && prefixMatch[1]) {
    const matchedVal = prefixMatch[1].trim();
    if (isRefusalOrCancellation(matchedVal) || isGreetingOrMenu(matchedVal) || isGratitudeOrPleasantry(matchedVal)) {
      return '';
    }
    return matchedVal;
  }

  // 3. Strip standard conversational prefixes
  let cleaned = converted
    .replace(/^(?:my\s*(?:player\s*)?(?:uid|id|email|account|number)\s*(?:is)?|amar\s*(?:uid|id|player\s*id|email|number)|আমার\s*(?:আইডি|প্লেয়ার\s*আইডি|প্লেয়ার\s*আইডি|ইউআইডি|ইমেইল|নম্বর))\s*[:=\-_]?\s*/i, '')
    .replace(/^(?:player\s*uid|player\s*id|playerid|uid|id|account|acc|email|phone|আইডি|ইউআইডি|ইমেইল|নম্বর)[\s:=#\-_]*/i, '')
    .replace(/[()[\]{}'"`]/g, ' ')
    .trim();

  if (isRefusalOrCancellation(cleaned) || isGreetingOrMenu(cleaned) || isGratitudeOrPleasantry(cleaned)) {
    return '';
  }

  // 4. Numeric sequence check (For PUBG UID, Free Fire UID, Phone Numbers: 5-15 digits)
  const digitsMatch = cleaned.match(/\b(\d{5,15})\b/);
  if (digitsMatch) {
    return digitsMatch[1];
  }

  // 5. BD 11-digit phone number check
  const phoneMatch = cleaned.match(/\b(01[3-9]\d{8})\b/);
  if (phoneMatch) {
    return phoneMatch[1];
  }

  // 6. If game strictly requires numeric UID (PUBG UID, Free Fire, PUBG KR)
  const isNumericUidGame = game.includes('uid') || game.includes('ff') || game.includes('free fire') || game.includes('kr');
  if (isNumericUidGame) {
    // Cannot accept plain English/Bengali words without numbers as UID
    const anyDigits = cleaned.match(/\d{4,15}/);
    if (anyDigits) {
      return anyDigits[0];
    }
    return ''; // Reject conversational text
  }

  // 7. For other login / special services, accept single alphanumeric handle if >= 3 chars
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length === 1) {
    const candidate = tokens[0];
    if (candidate.length >= 3 && !isRefusalOrCancellation(candidate) && !isGreetingOrMenu(candidate)) {
      return candidate.trim();
    }
  }

  return '';
}

/**
 * Information regarding how to display the user's account / identifier
 */
export interface AccountFieldInfo {
  labelEn: string;
  labelBn: string;
  emoji: string;
  isEmail: boolean;
}

export function getAccountFieldInfo(identifierValue?: string, gameLabelOrCode?: string): AccountFieldInfo {
  const val = identifierValue || '';
  const game = (gameLabelOrCode || '').toLowerCase();

  // 1. PUBG UID Top-Up & Subscriptions
  if (game.includes('pubg')) {
    if (game.includes('login') || game.includes('special')) {
      return {
        labelEn: 'Phone / Contact (QR)',
        labelBn: 'হোয়াটসঅ্যাপ / যোগাযোগ নম্বর',
        emoji: '📲',
        isEmail: false
      };
    }
    return {
      labelEn: 'Player UID (PUBG)',
      labelBn: 'Player UID',
      emoji: '🎮',
      isEmail: false
    };
  }

  // 2. Free Fire Diamonds
  if (game.includes('ff') || game.includes('free fire') || game.includes('diamond')) {
    return {
      labelEn: 'Player UID (Free Fire)',
      labelBn: 'Player UID',
      emoji: '🔥',
      isEmail: false
    };
  }

  // 3. eFootball Coins
  if (game.includes('efb') || game.includes('efootball') || game.includes('konami')) {
    return {
      labelEn: 'Konami ID / Email',
      labelBn: 'Konami ID / ইমেইল',
      emoji: '⚽',
      isEmail: val.includes('@')
    };
  }

  // 4. Movie / Anime / Music Streaming Subscriptions (Netflix, Prime, Spotify, YouTube, Crunchyroll)
  if (val.includes('@') || game.includes('movie') || game.includes('netflix') || game.includes('spotify') || game.includes('prime') || game.includes('crunchyroll') || game.includes('youtube')) {
    return {
      labelEn: 'Email / Gmail Account',
      labelBn: 'ইমেইল / Gmail অ্যাকাউন্ট',
      emoji: '📧',
      isEmail: true
    };
  }

  // 5. Generic Login / WhatsApp QR services
  if (game.includes('login') || game.includes('qr') || game.includes('whatsapp')) {
    return {
      labelEn: 'Phone / Contact',
      labelBn: 'মোবাইল / হোয়াটসঅ্যাপ নম্বর',
      emoji: '📲',
      isEmail: false
    };
  }

  // 6. Default Player UID
  return {
    labelEn: 'Player UID',
    labelBn: 'Player UID',
    emoji: '🎮',
    isEmail: false
  };
}

export interface ExtractedPayment {
  paymentMethod: string;
  trxId?: string;
  lastDigits?: string;
  senderPhone?: string;
  proofType: 'BOTH' | 'TRX_ID' | 'LAST_4' | 'PHONE' | 'NONE';
  rawProof: string;
  isValid: boolean;
}

const NON_TRX_WORDS = new Set([
  'SEND', 'SENT', 'KORECI', 'KORECHI', 'PATHAISI', 'PATHALAM', 'DILAM', 'DISI',
  'DONE', 'PAID', 'PAYMENT', 'COMPLETE', 'COMPLETED', 'CHECK', 'KOREN', 'DEKHEN',
  'BHAI', 'BRO', 'SIR', 'APU', 'SS', 'SCREENSHOT', 'PICTURE', 'PIC', 'IMAGE',
  'DIBO', 'PORE', 'THAK', 'HOBE', 'NAI', 'HOISE', 'HOICE', 'DIASO', 'DIYECHI',
  'BKASH', 'BAKSH', 'NAGAD', 'ROCKET', 'UPAY', 'SENDMONEY', 'CASHIN', 'CASHOUT',
  'ORDER', 'CONFIRM', 'CANCEL', 'HELLO', 'HI', 'THANKS', 'TNX', 'DHONNOBAD',
  'TAKA', 'MONEY', 'ACCOUNT', 'NUMBER', 'AMOUNT', 'NOW', 'PLEASE', 'PLZ',
  'YES', 'NO', 'OK', 'OKAY', 'ACHE', 'ASI', 'ACCOUNTS', 'NOTUN', 'KORBO',
  'DELIVERY', 'STATUS', 'PRICE', 'KOTO', 'DAM'
]);

export interface PaymentProofContext {
  expectedAmount?: number;
  recipientAccount?: string;
  playerUid?: string;
}

/**
 * Extract clean Payment Method, TrxID, Last 4 Digits or Combined Proof strictly
 */
export function extractPaymentProof(
  rawText: string,
  context?: PaymentProofContext
): ExtractedPayment {
  if (!rawText) {
    return {
      paymentMethod: 'BKASH/NAGAD/ROCKET',
      proofType: 'NONE',
      rawProof: '',
      isValid: false
    };
  }

  const text = convertBengaliDigits(rawText.trim());
  const lower = text.toLowerCase();

  // 1. Detect Payment Method
  let paymentMethod = 'BKASH/NAGAD/ROCKET';
  if (lower.includes('bkash') || lower.includes('baksh') || text.includes('বিকাশ')) {
    paymentMethod = 'BKASH';
  } else if (lower.includes('nagad') || text.includes('নগদ')) {
    paymentMethod = 'NAGAD';
  } else if (lower.includes('rocket') || text.includes('রকেট')) {
    paymentMethod = 'ROCKET';
  } else if (lower.includes('upay') || text.includes('উপায়') || text.includes('উপায়')) {
    paymentMethod = 'UPAY';
  }

  // 2. Check for explicit TrxID prefix (e.g. "TrxID: 9J7A291A", "Trx: BL89AK2L0P", "TxnID 10293812", "BKASH-TRX-101")
  let foundTrxId: string | undefined;
  const trxPrefixMatch = text.match(
    /(?:trx\s*id|trx|tx\s*id|txid|txn\s*id|txnid|transaction\s*id|trans\s*id|টিএক্স\s*আইডি|টিএক্স|ট্রানজেকশন\s*আইডি)[\s:=#\-_]*([a-zA-Z0-9]{3,25})/i
  );
  if (trxPrefixMatch && trxPrefixMatch[1]) {
    const candidate = trxPrefixMatch[1].trim().toUpperCase();
    const isBlacklisted = NON_TRX_WORDS.has(candidate);
    const hasDigits = /[0-9]/.test(candidate);
    // Real TrxID must not be a conversational word and must have digits or be >= 6 alphanumeric chars
    if (!isBlacklisted && (hasDigits || candidate.length >= 6)) {
      foundTrxId = candidate;
    }
  }

  // 2b. If no prefix, check for standalone alphanumeric TrxID (mixed digits + letters, e.g. "9J7A291A", "BK1049281")
  if (!foundTrxId) {
    const alphanumericTokens = text.match(/\b([A-Za-z0-9]{6,20})\b/g);
    if (alphanumericTokens) {
      for (const token of alphanumericTokens) {
        const candidate = token.trim().toUpperCase();
        if (
          !NON_TRX_WORDS.has(candidate) &&
          /[0-9]/.test(candidate) &&
          /[a-zA-Z]/.test(candidate) &&
          candidate.length >= 6
        ) {
          foundTrxId = candidate;
          break;
        }
      }
    }
  }

  // 3. Check for explicit Last 4 Digits (e.g. "last 4 digit 4591", "লাস্ট ৪ সংখ্যা ৪৫৯১")
  let foundLastDigits: string | undefined;
  const lastDigitsMatch = text.match(
    /(?:last\s*(?:4\s*)?(?:digit|digits|no|num|number|code|সংখ্যার?|ডিজিট|নম্বর)?|লাস্ট\s*(?:৪\s*)?(?:ডিজিট|সংখ্যা|নম্বর)?)[\s:=#\-_]*([0-9]{3,6})/i
  );
  if (lastDigitsMatch && lastDigitsMatch[1]) {
    const candidateDigits = lastDigitsMatch[1].trim();
    const numericVal = parseInt(candidateDigits, 10);
    // Must not be the expected payment amount (e.g. 115)
    if (!context?.expectedAmount || numericVal !== context.expectedAmount) {
      foundLastDigits = candidateDigits;
    }
  }

  // 4. Check for full 11-digit sender phone number
  let foundPhone: string | undefined;
  const phoneMatch = text.match(/\b(01[3-9]\d{8})\b/);
  if (phoneMatch) {
    const matchedPhone = phoneMatch[1].trim();
    // Exclude the shop's own recipient accounts
    const knownShopAccounts = ['01330719250', '01859666014', '01700000000'];
    const isShopAccount =
      knownShopAccounts.includes(matchedPhone) ||
      (context?.recipientAccount && matchedPhone.includes(context.recipientAccount.replace(/\D/g, '')));
    if (!isShopAccount) {
      foundPhone = matchedPhone;
    }
  }

  // 5. Standalone 4 digits (e.g. customer sends just "4591" or " 0912 ")
  if (!foundTrxId && !foundLastDigits && !foundPhone) {
    const standaloneDigitsMatch = text.match(/^\s*([0-9]{4})\s*$/);
    if (standaloneDigitsMatch) {
      const candidateDigits = standaloneDigitsMatch[1].trim();
      const numericVal = parseInt(candidateDigits, 10);
      if (
        (!context?.expectedAmount || numericVal !== context.expectedAmount) &&
        (!context?.playerUid || candidateDigits !== context.playerUid)
      ) {
        foundLastDigits = candidateDigits;
      }
    }
  }

  // Determine Proof Type & Raw Formatted Proof
  if (foundTrxId && foundLastDigits) {
    return {
      paymentMethod,
      trxId: foundTrxId,
      lastDigits: foundLastDigits,
      proofType: 'BOTH',
      rawProof: `TrxID: ${foundTrxId} | Last 4: ${foundLastDigits}`,
      isValid: true
    };
  }

  if (foundTrxId) {
    return {
      paymentMethod,
      trxId: foundTrxId,
      proofType: 'TRX_ID',
      rawProof: foundTrxId,
      isValid: true
    };
  }

  if (foundLastDigits) {
    return {
      paymentMethod,
      lastDigits: foundLastDigits,
      proofType: 'LAST_4',
      rawProof: foundLastDigits,
      isValid: true
    };
  }

  if (foundPhone) {
    return {
      paymentMethod,
      senderPhone: foundPhone,
      proofType: 'PHONE',
      rawProof: foundPhone,
      isValid: true
    };
  }

  // No valid payment proof found (pure conversational text like "Baksh e send koreci", "taka disi", "done")
  return {
    paymentMethod,
    proofType: 'NONE',
    rawProof: '',
    isValid: false
  };
}

/**
 * Format payment method and proof for WhatsApp Customer Card
 */
export function formatPaymentDisplayForWhatsApp(
  proofText?: string,
  methodName?: string
): string {
  const method = methodName || 'bKash/Nagad/Rocket';
  const proof = (proofText || '').trim();

  if (!proof || proof === 'N/A') {
    return method;
  }

  // If already formatted with "TrxID: ... | Last 4: ..."
  if (proof.includes('TrxID:') && proof.includes('Last 4:')) {
    const trxPart = proof.match(/TrxID:\s*([^|]+)/i)?.[1]?.trim() || '';
    const lastPart = proof.match(/Last 4:\s*([^|]+)/i)?.[1]?.trim() || '';
    return `${method} (TrxID: \`${trxPart}\` | লাস্ট ৪ ডিজিট: \`${lastPart}\`)`;
  }

  // If it's a 3-6 digit number (Last digits)
  if (/^\d{3,6}$/.test(proof)) {
    return `${method} (লাস্ট ৪ ডিজিট: \`${proof}\`)`;
  }

  // If it's an 11 digit phone number
  if (/^01[3-9]\d{8}$/.test(proof)) {
    return `${method} (সেন্ডার নম্বর: \`${proof}\`)`;
  }

  // If standard alphanumeric TrxID
  return `${method} (TrxID: \`${proof}\`)`;
}

/**
 * Format payment lines for Telegram Worker Card
 */
export function formatPaymentDisplayForTelegram(
  proofText?: string,
  methodName?: string,
  invoiceId?: string
): { methodLabel: string; proofLines: string; isAutoVerified: boolean } {
  let methodLabel = methodName || 'bKash/Nagad/Rocket';
  if (methodLabel.toUpperCase() === 'BKASH') methodLabel = 'bKash';
  if (methodLabel.toUpperCase() === 'NAGAD') methodLabel = 'Nagad';
  if (methodLabel.toUpperCase() === 'ROCKET') methodLabel = 'Rocket';

  const proof = (proofText || '').trim();
  const isAuto = Boolean(
    invoiceId ||
    methodName?.toUpperCase().includes('ZINIPAY') ||
    proof.toUpperCase().includes('ZINI')
  );

  if (isAuto) {
    const invLine = invoiceId ? `\n🧾 <b>Invoice:</b> <code>${invoiceId}</code>` : '';
    const cleanMethod = methodName?.toUpperCase().includes('ZINIPAY') ? 'ZiniPay Gateway' : `${methodLabel} (Auto-Paid)`;
    return {
      methodLabel: `🟢 Auto-Verified (${cleanMethod})`,
      proofLines: `🔢 <b>TrxID:</b> <code>${proof || 'VERIFIED'}</code>${invLine}\n⚡ <b>Status:</b> <b>✅ Paid via Gateway (SMS চেক দরকার নেই)</b>`,
      isAutoVerified: true
    };
  }

  if (!proof || proof === 'N/A') {
    return {
      methodLabel,
      proofLines: `🔢 <b>Payment Proof:</b> <code>N/A</code>`,
      isAutoVerified: false
    };
  }

  // If both TrxID & Last 4
  if (proof.includes('TrxID:') && proof.includes('Last 4:')) {
    const trxPart = proof.match(/TrxID:\s*([^|]+)/i)?.[1]?.trim() || '';
    const lastPart = proof.match(/Last 4:\s*([^|]+)/i)?.[1]?.trim() || '';
    return {
      methodLabel,
      proofLines: `🔢 <b>TrxID:</b> <code>${trxPart}</code>\n📱 <b>Sender Last 4:</b> <code>${lastPart}</code>`,
      isAutoVerified: false
    };
  }

  // If 3-6 digits
  if (/^\d{3,6}$/.test(proof)) {
    return {
      methodLabel,
      proofLines: `📱 <b>Sender Last 4:</b> <code>${proof}</code>`,
      isAutoVerified: false
    };
  }

  // If 11 digit phone number
  if (/^01[3-9]\d{8}$/.test(proof)) {
    return {
      methodLabel,
      proofLines: `📱 <b>Sender Phone:</b> <code>${proof}</code>`,
      isAutoVerified: false
    };
  }

  // Default alphanumeric TrxID
  return {
    methodLabel,
    proofLines: `🔢 <b>TrxID:</b> <code>${proof}</code>`,
    isAutoVerified: false
  };
}

/**
 * Dynamic delivery ETA text and buttons based on product category
 */
export function getGameDeliveryConfig(gameTitleOrCode?: string, firstItemName?: string): {
  deliveryMessage: string;
  catalogButtonTitle: string;
  catalogButtonId: string;
} {
  const text = `${gameTitleOrCode || ''} ${firstItemName || ''}`.toLowerCase();

  if (text.includes('netflix') || text.includes('movie') || text.includes('anime') || text.includes('spotify') || text.includes('prime') || text.includes('crunchyroll') || text.includes('youtube') || (text.includes('sub') && !text.includes('pubg'))) {
    return {
      deliveryMessage: 'আমাদের টিম খুব দ্রুত আপনার সাবস্ক্রিপশন চালু করে অ্যাকাউন্ট/লগইন তথ্য পাঠিয়ে দেবে! 🍿🚀',
      catalogButtonTitle: '🍿 সাবস্ক্রিপশন',
      catalogButtonId: 'game_movie'
    };
  }

  if (text.includes('free fire') || text.includes('ff') || text.includes('diamond')) {
    return {
      deliveryMessage: 'আমাদের টপ-আপ টিম খুব দ্রুত আপনার আইডিতে ডায়মন্ড পাঠিয়ে দেবে! 🔥🚀',
      catalogButtonTitle: '🔥 Diamond প্রাইস',
      catalogButtonId: 'game_ff'
    };
  }

  if (text.includes('pubg') || text.includes('uc')) {
    return {
      deliveryMessage: 'আমাদের টপ-আপ টিম খুব দ্রুত আপনার আইডিতে ইউসি পাঠিয়ে দেবে! 🎮🚀',
      catalogButtonTitle: '💎 UC প্রাইস',
      catalogButtonId: 'game_pubg_uid'
    };
  }

  if (text.includes('efootball') || text.includes('fifa') || text.includes('fc mobile') || text.includes('coin')) {
    return {
      deliveryMessage: 'আমাদের টিম খুব দ্রুত আপনার আইডিতে কয়েন/পয়েন্ট টপ-আপ করে দেবে! ⚽🚀',
      catalogButtonTitle: '⚽ কয়েন প্রাইস',
      catalogButtonId: 'game_efb_android'
    };
  }

  return {
    deliveryMessage: 'আমাদের টপ-আপ টিম খুব দ্রুত আপনার সার্ভিসটি সম্পন্ন করে দেবে! 🚀',
    catalogButtonTitle: '🎮 গেম তালিকা',
    catalogButtonId: 'btn_game_list'
  };
}

/**
 * Check if a text is an expression of gratitude, appreciation, acknowledgement, or completion
 */
export function isGratitudeOrPleasantry(rawText: string): boolean {
  if (!rawText) return false;
  const text = rawText.trim().toLowerCase();

  // Single emoji checks
  if (/^[\p{Emoji}\s]+$/u.test(text) && !/[0-9a-zA-Z]/.test(text)) {
    return true;
  }

  // Exact or contains keywords
  const gratitudePatterns = [
    /\b(?:thank\s*you|thank\s*u|thankyou|thanks|thx|tnx|tq|ty|thnk\s*u)\b/i,
    /(?:ধন্যবাদ|অনেক\s*ধন্যবাদ|ধন্যবাদ\s*ভাই|শুকরিয়া|থ্যাংকস|থ্যাংক\s*ইউ)/,
    /\b(?:nice|good|great|awesome|super|superb|best|excellent|perfect)\b/i,
    /(?:valo|bhalo|khub\s*valo|khub\s*bhalo|onk\s*bhalo|osadharon|valo\s*laglo|valobasha|valobasa)/i,
    /(?:অসাধারণ|সুন্দর|অনেক\s*সুন্দর|অনেক\s*ভালো|ভালো|খুব\s*ভালো)/,
    /\b(?:welcome|most\s*welcome|wc)\b/i,
    /(?:স্বাগতম|মোস্ট\s*ওয়েলকাম)/,
    /\b(?:ok|okay|okk|okey|done|all\s*done|kothao\s*hobe|alright|fine)\b/i,
    /(?:thik\s*ase|thik\s*ache|accha|achha|thik|hoise|hoyeche)/i,
    /(?:ঠিক\s*আছে|আচ্ছা|হয়েছে|হইছে|ঠিক|ডান)/,
    /\b(?:peyechi|paisi|paici|got\s*it|received|got\s*it\s*bro|delivery\s*peyechi)\b/i,
    /(?:পেয়েছি|পাইছি|টপ\s*আপ\s*পেয়েছি|ইউসি\s*পেয়েছি|ডেলিভারি\s*পেয়েছি)/,
    /\b(?:love\s*you|love\s*u|fast\s*delivery|fast\s*service)\b/i
  ];

  return gratitudePatterns.some(pattern => pattern.test(text));
}

/**
 * Check if a text is asking for order delivery speed / time / progress
 */
export function isStatusInquiry(rawText: string): boolean {
  if (!rawText) return false;
  const text = rawText.trim().toLowerCase();

  const statusPatterns = [
    /(?:koto\s*khon|koto\s*shomoy|koto\s*somoy|koto\s*der|deri\s*hobe|shuru\s*hoise|shuru\s*hobe)/i,
    /(?:check\s*(?:korun|please|plz)?|dekhen|dekhsen|taka\s*gese|taka\s*paisen|payment\s*paisen)/i,
    /(?:status|update|progress|delivery\s*kobe|kobe\s*pabo|kokhon\s*pabo)/i,
    /(?:কতক্ষণ\s*লাগবে|দেরি\s*হবে|কখন\s*পাব|চেক\s*করুন|টাকা\s*গেছে|পেমেন্ট\s*পেয়েছেন|আপডেট|স্ট্যাটাস)/
  ];

  return statusPatterns.some(pattern => pattern.test(text));
}

/**
 * Check if a text expresses customer refusal, cancellation, or change of mind
 * (e.g. "No kinbo na", "pore nibo", "lagbe na", "nibo na", "cancel", "দরকার নেই", "থাক")
 */
export function isRefusalOrCancellation(rawText: string): boolean {
  if (!rawText) return false;
  const text = rawText.trim().toLowerCase();
  const clean = text.replace(/[^\w\s\u0980-\u09FF]/g, ' ').replace(/\s+/g, ' ').trim();

  // 1. Never treat payment proofs, account numbers, or "no" (abbreviation for "number") as refusal
  if (
    /(?:last|acc|account|trx|tx|mobile|phone|sender|bkash|nagad|rocket|card|serial|sl)\s*(?:no|num|number)\b/i.test(text) ||
    /\bno[\s.:#]*\d+/i.test(text) ||
    /\bno\s*(?:problem|problm|prob|prblm|issue|worries|worry)\b/i.test(text)
  ) {
    return false;
  }

  // If text contains a valid payment proof (TrxID, last 4 digits, or sender phone), it is NEVER a refusal
  const paymentCheck = extractPaymentProof(rawText);
  if (paymentCheck.isValid && paymentCheck.rawProof) {
    return false;
  }

  const refusalWords = [
    'no', 'nah', 'na', 'nope', 'never', 'cancel', 'stop', 'back', 'thak',
    'না', 'না না', 'নাহ', 'বাতিল', 'থাক', 'দরকার নেই', 'দরকার নাই', 'দরকার নাই ভাই',
    'kinbo na', 'kinto chai na', 'nibo na', 'lagbe na', 'pore nibo', 'pore bolbo',
    'pore', 'later', 'not now', 'dont want', 'dont need', 'no thanks',
    'কিনব না', 'কিনবো না', 'নিব না', 'নিবো না', 'লাগবে না', 'দরকার নেই',
    'পরে নিব', 'পরে নিবো', 'পরে বলব', 'পরে বলবো', 'এখন না', 'চাই না', 'বাদ দেন', 'বাদ দাও'
  ];

  if (refusalWords.includes(text) || refusalWords.includes(clean)) {
    return true;
  }

  const refusalPatterns = [
    /\b(?:not\s*now|dont\s*want|don't\s*want|dont\s*need|don't\s*need|no\s*need|no\s*thanks|no\s*thx|no\s+(?:bro|brother|bhai|vai|sir|kintu|pore|lagbe|nibo|chai|dorkar|bad))\b/i,
    /(?:kinbo\s*na|kinbo\s*nah|nibo\s*na|nibo\s*nah|lagbe\s*na|lagbo\s*na|dorkar\s*nai|dorkar\s*nei)/i,
    /(?:pore\s*nibo|pore\s*kinbo|pore\s*bolbo|pore\s*hobe|thak\s*lagbe\s*na|bad\s*den)/i,
    /(?:(?:^|\s)(?:না|নাহ)(?:\s|$)|দরকার\s*(?:নেই|নাই)|লাগবে\s*না|কিনব[ও]?\s*না|নিব[ও]?\s*না|পরে\s*(?:নিব[ও]?|হবে|বলব[ও]?)|বাদ\s*(?:দেন|দাও)|চাই\s*না|এখন\s*না)/
  ];

  return refusalPatterns.some(p => p.test(clean) || p.test(text));
}

/**
 * Check if a text is asking for price or packages
 */
export function isPriceInquiry(rawText: string): boolean {
  if (!rawText) return false;
  const text = rawText.trim().toLowerCase();
  const clean = text.replace(/[^\w\s\u0980-\u09FF]/g, ' ').replace(/\s+/g, ' ').trim();

  const pricePatterns = [
    /\b(?:price|rate|cost|package|pkg|packages|price\s*list)\b/i,
    /(?:dam\s*koto|price\s*koto|koto\s*taka|koto\s*tk|koto\s*kore|rate\s*koto)/i,
    /(?:দাম\s*কত|প্রাইস\s*কত|টাকা\s*কত|রেট\s*কত|প্রাইস\s*লিস্ট|প্যাকেজ|মূল্য\s*কত)/
  ];

  return pricePatterns.some(p => p.test(clean) || p.test(text));
}

/**
 * Check if a text is a standard greeting, menu, back, or cancel request
 */
export function isGreetingOrMenu(rawText: string): boolean {
  if (!rawText) return false;
  const text = rawText.trim().toLowerCase();

  // Strip emojis, punctuation and redundant spaces for robust matching
  const clean = text.replace(/[^\w\s\u0980-\u09FF]/g, ' ').replace(/\s+/g, ' ').trim();

  const greetingWords = [
    'hi', 'hello', 'hey', 'start', 'menu', 'help', 'shuru', 
    'kemon achen', 'assalamu alaikum', 'assalamualaikum', 'salam', 'slm',
    'হাই', 'হ্যালো', 'সালাম', 'শুরু', 'মেনু', 'হেল্প', 'কেমন আছেন',
    'main menu', 'মেইন মেনু', 'মেইনমেনু', 'মেইন মেন্যু', 'মেন্যু',
    'cancel', 'বাতিল', 'বাতিল করুন', 'back', 'পিছনে', 'ফিরে যান',
    'restart', 'রিস্টার্ট', 'home', 'হোম', 'list', 'তালিকা', 'সব গেম', 'সব সার্ভিস'
  ];

  if (greetingWords.includes(text) || greetingWords.includes(clean)) {
    return true;
  }

  return /^(?:hi|hello|hey|salam|assalamu\s*alaikum|start|menu|main\s*menu|cancel|back|help)\b/i.test(clean) ||
         /(?:মেইন\s*মেনু|মেনু|বাতিল|ক্যানসেল|হোম|শুরু|রিস্টার্ট)/.test(clean);
}

/**
 * Slash Command parser (e.g. /menu, /start, /track, /cancel, /website, /help, /movie, /pubg, /ff, /efootball)
 */
export interface SlashCommandResult {
  isSlashCommand: boolean;
  command: string; // e.g. 'menu', 'start', 'track', 'website', 'help', 'pubg', 'movie', 'ff', 'efootball', 'cancel'
  args?: string;   // e.g. 'WAP-20260918-1234' for /track WAP-20260918-1234
}

export function parseSlashCommand(rawText: string): SlashCommandResult | null {
  if (!rawText) return null;
  const trimmed = rawText.trim();
  if (!trimmed.startsWith('/') && !trimmed.startsWith('!')) return null;

  const parts = trimmed.slice(1).trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase() || '';
  const args = parts.slice(1).join(' ').trim();

  if (!cmd) return null;

  // 1. Menu & Navigation Commands
  if (['start', 'menu', 'main', 'mainmenu', 'games', 'services', 'catalog', 'shuru', 'home', 'মেনু', 'শুরু'].includes(cmd)) {
    return { isSlashCommand: true, command: 'menu', args };
  }

  // 2. Track & Status
  if (['track', 'status', 'order', 'trackorder', 'ট্র্যাক'].includes(cmd)) {
    return { isSlashCommand: true, command: 'track', args };
  }

  // 3. Website & Discounts
  if (['web', 'website', 'site', 'discount', 'offer', 'ওয়েবসাইট', 'ওয়েবসাইট'].includes(cmd)) {
    return { isSlashCommand: true, command: 'website', args };
  }

  // 4. Help & Support
  if (['help', 'support', 'contact', 'info', 'guide', 'হেল্প', 'সাহায্য'].includes(cmd)) {
    return { isSlashCommand: true, command: 'help', args };
  }

  // 5. Cancel & Reset
  if (['cancel', 'reset', 'restart', 'stop', 'back', 'বাতিল'].includes(cmd)) {
    return { isSlashCommand: true, command: 'cancel', args };
  }

  // 6. Direct Service Shortcuts
  if (['movie', 'netflix', 'anime', 'crunchyroll', 'spotify', 'prime', 'subs', 'subscription', 'মুভি'].includes(cmd)) {
    return { isSlashCommand: true, command: 'movie', args };
  }
  if (['pubg', 'uc', 'pubgkr', 'kr', 'পাবজি'].includes(cmd)) {
    return { isSlashCommand: true, command: 'pubg', args };
  }
  if (['ff', 'freefire', 'diamond', 'diamonds', 'ফ্রিফায়ার'].includes(cmd)) {
    return { isSlashCommand: true, command: 'ff', args };
  }
  if (['efootball', 'efb', 'pes', 'coin', 'coins', 'ইফুটবল'].includes(cmd)) {
    return { isSlashCommand: true, command: 'efootball', args };
  }

  return { isSlashCommand: true, command: cmd, args };
}

