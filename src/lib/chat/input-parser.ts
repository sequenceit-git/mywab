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
 * Extract clean, trimmed Player UID / Email Account / Phone / Game ID
 */
export function extractCleanUid(rawText: string): string {
  if (!rawText) return '';
  const converted = convertBengaliDigits(rawText.trim());

  // 1. Check if input contains an Email address (e.g. "okovijit@gmail.com" or "Email: okovijit@gmail.com")
  const emailMatch = converted.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    return emailMatch[0].trim();
  }

  // 2. Check if matches key-value prefix like "UID: 123456", "Player ID 123456", "ID: 123456", "আমার আইডি: 123456"
  const prefixMatch = converted.match(
    /(?:player\s*uid|player\s*id|playerid|uid|id|account|acc|user\s*id|email|gmail|আইডি|ইউআইডি|প্লেয়ার\s*আইডি|প্লেয়ার\s*আইডি|ইমেইল|জিমেইল)[\s:=#\-_]+([^\s,;()\[\]{}]+)/i
  );
  if (prefixMatch && prefixMatch[1]) {
    return prefixMatch[1].trim();
  }

  // 3. Strip standard conversational prefixes
  let cleaned = converted
    .replace(/^(?:my\s*(?:player\s*)?(?:uid|id|email|account)\s*(?:is)?|amar\s*(?:uid|id|player\s*id|email)|আমার\s*(?:আইডি|প্লেয়ার\s*আইডি|প্লেয়ার\s*আইডি|ইউআইডি|ইমেইল))\s*[:=\-_]?\s*/i, '')
    .replace(/^(?:player\s*uid|player\s*id|playerid|uid|id|account|acc|email|আইডি|ইউআইডি|ইমেইল)[\s:=#\-_]*/i, '')
    .replace(/[()[\]{}'"`]/g, ' ')
    .trim();

  // 4. If there is a sequence of 5-15 digits at the start (e.g. "5875547 (nick)" -> "5875547")
  const leadingDigits = cleaned.match(/^(\d{5,15})\b/);
  if (leadingDigits) {
    return leadingDigits[1];
  }

  // 5. If first token is valid (e.g. "player#1234" or standard ID)
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length > 0) {
    const candidate = tokens[0];
    if (candidate.length >= 3) {
      return candidate.trim();
    }
  }

  return (cleaned || converted).trim();
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
  proofType: 'BOTH' | 'TRX_ID' | 'LAST_4' | 'PHONE' | 'CUSTOM';
  rawProof: string;
}

/**
 * Extract clean Payment Method, TrxID, Last 4 Digits or Combined Proof
 */
export function extractPaymentProof(rawText: string): ExtractedPayment {
  if (!rawText) {
    return {
      paymentMethod: 'BKASH/NAGAD/ROCKET',
      proofType: 'CUSTOM',
      rawProof: 'N/A'
    };
  }

  const text = convertBengaliDigits(rawText.trim());
  const lower = text.toLowerCase();

  // 1. Detect Payment Method
  let paymentMethod = 'BKASH/NAGAD/ROCKET';
  if (lower.includes('bkash') || text.includes('বিকাশ')) {
    paymentMethod = 'BKASH';
  } else if (lower.includes('nagad') || text.includes('নগদ')) {
    paymentMethod = 'NAGAD';
  } else if (lower.includes('rocket') || text.includes('রকেট')) {
    paymentMethod = 'ROCKET';
  } else if (lower.includes('upay') || text.includes('উপায়') || text.includes('উপায়')) {
    paymentMethod = 'UPAY';
  }

  // 2. Check for explicit TrxID
  let foundTrxId: string | undefined;
  const trxMatch = text.match(
    /(?:trx\s*id|trx|tx\s*id|txid|transaction\s*id|trans\s*id|ট্রানজেকশন\s*আইডি|টিএক্স\s*আইডি|টিএক্স)[\s:=#\-_]*([a-zA-Z0-9]{5,20})/i
  );
  if (trxMatch && trxMatch[1]) {
    foundTrxId = trxMatch[1].trim().toUpperCase();
  } else {
    // Alphanumeric standard TrxID (contains letters + digits)
    const alphanumericTrx = text.match(/\b([A-Za-z0-9]{8,12})\b/);
    if (alphanumericTrx && /[0-9]/.test(alphanumericTrx[1]) && /[a-zA-Z]/.test(alphanumericTrx[1])) {
      foundTrxId = alphanumericTrx[1].trim().toUpperCase();
    }
  }

  // 3. Check for explicit Last 4 Digits (or 3-6 digit sender digits)
  let foundLastDigits: string | undefined;
  const lastDigitsMatch = text.match(
    /(?:last\s*(?:4\s*)?(?:digit|digits|no|num|number|code|সংখ্যার?|ডিজিট|নম্বর)?|লাস্ট\s*(?:৪\s*)?(?:ডিজিট|সংখ্যা|নম্বর)?)[\s:=#\-_]*([0-9]{3,6})/i
  );
  if (lastDigitsMatch && lastDigitsMatch[1]) {
    foundLastDigits = lastDigitsMatch[1].trim();
  }

  // 4. Check for full 11-digit phone number
  let foundPhone: string | undefined;
  const phoneMatch = text.match(/\b(01[3-9]\d{8})\b/);
  if (phoneMatch) {
    foundPhone = phoneMatch[1].trim();
  }

  // 5. Standalone 3-6 digit number (if not already found as TrxID)
  if (!foundTrxId && !foundLastDigits && !foundPhone) {
    const standaloneDigits = text.match(/\b(\d{3,6})\b/);
    if (standaloneDigits) {
      foundLastDigits = standaloneDigits[1].trim();
    }
  }

  // Determine Proof Type & Raw Formatted Proof
  if (foundTrxId && foundLastDigits) {
    return {
      paymentMethod,
      trxId: foundTrxId,
      lastDigits: foundLastDigits,
      proofType: 'BOTH',
      rawProof: `TrxID: ${foundTrxId} | Last 4: ${foundLastDigits}`
    };
  }

  if (foundTrxId) {
    return {
      paymentMethod,
      trxId: foundTrxId,
      proofType: 'TRX_ID',
      rawProof: foundTrxId
    };
  }

  if (foundLastDigits) {
    return {
      paymentMethod,
      lastDigits: foundLastDigits,
      proofType: 'LAST_4',
      rawProof: foundLastDigits
    };
  }

  if (foundPhone) {
    return {
      paymentMethod,
      senderPhone: foundPhone,
      proofType: 'PHONE',
      rawProof: foundPhone
    };
  }

  // Fallback cleanup
  const cleaned = text
    .replace(/(?:bkash|nagad|rocket|upay|বিকাশ|নগদ|রকেট|উপায়|send|money|koresi|koreci|korsi|diasi|dici|done|taka|pathaisi|pathano|hoise|last|no|digit|number|লাস্ট|টাকা|পাঠিয়েছি|পাঠাইছি)/gi, ' ')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    paymentMethod,
    proofType: 'CUSTOM',
    rawProof: cleaned || text || 'N/A'
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
  methodName?: string
): { methodLabel: string; proofLines: string } {
  let methodLabel = methodName || 'bKash/Nagad/Rocket';
  if (methodLabel.toUpperCase() === 'BKASH') methodLabel = 'bKash';
  if (methodLabel.toUpperCase() === 'NAGAD') methodLabel = 'Nagad';
  if (methodLabel.toUpperCase() === 'ROCKET') methodLabel = 'Rocket';

  const proof = (proofText || '').trim();

  if (!proof || proof === 'N/A') {
    return {
      methodLabel,
      proofLines: `🔢 <b>Payment Proof:</b> <code>N/A</code>`
    };
  }

  // If both TrxID & Last 4
  if (proof.includes('TrxID:') && proof.includes('Last 4:')) {
    const trxPart = proof.match(/TrxID:\s*([^|]+)/i)?.[1]?.trim() || '';
    const lastPart = proof.match(/Last 4:\s*([^|]+)/i)?.[1]?.trim() || '';
    return {
      methodLabel,
      proofLines: `🔢 <b>TrxID:</b> <code>${trxPart}</code>\n📱 <b>Sender Last 4:</b> <code>${lastPart}</code>`
    };
  }

  // If 3-6 digits
  if (/^\d{3,6}$/.test(proof)) {
    return {
      methodLabel,
      proofLines: `📱 <b>Sender Last 4:</b> <code>${proof}</code>`
    };
  }

  // If 11 digit phone number
  if (/^01[3-9]\d{8}$/.test(proof)) {
    return {
      methodLabel,
      proofLines: `📱 <b>Sender Phone:</b> <code>${proof}</code>`
    };
  }

  // Default alphanumeric TrxID
  return {
    methodLabel,
    proofLines: `🔢 <b>TrxID:</b> <code>${proof}</code>`
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
 * Check if a text is a standard greeting or menu request
 */
export function isGreetingOrMenu(rawText: string): boolean {
  if (!rawText) return false;
  const text = rawText.trim().toLowerCase();

  const greetingWords = [
    'hi', 'hello', 'hey', 'start', 'menu', 'help', 'shuru', 
    'kemon achen', 'assalamu alaikum', 'assalamualaikum', 'salam', 'slm',
    'হাই', 'হ্যালো', 'সালাম', 'শুরু', 'মেনু', 'হেল্প', 'কেমন আছেন'
  ];

  return greetingWords.includes(text) || /^(?:hi|hello|hey|salam|assalamu\s*alaikum)\b/i.test(text);
}
