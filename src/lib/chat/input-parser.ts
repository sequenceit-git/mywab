/**
 * Helpers for parsing, cleaning and formatting user inputs from WhatsApp
 * (e.g. Player UID, Game IDs, TrxIDs, Last 4 digits, Payment methods, Bangla numerals)
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
 * Extract clean, trimmed Player UID / Game ID / Account info
 */
export function extractCleanUid(rawText: string): string {
  if (!rawText) return '';
  const converted = convertBengaliDigits(rawText.trim());

  // 1. Check if matches key-value prefix like "UID: 123456", "Player ID 123456", "ID: 123456", "আমার আইডি: 123456"
  const prefixMatch = converted.match(
    /(?:player\s*uid|player\s*id|playerid|uid|id|account|acc|user\s*id|আইডি|ইউআইডি|প্লেয়ার\s*আইডি|প্লেয়ার\s*আইডি)[\s:=#\-_]+([^\s,;()\[\]{}]+)/i
  );
  if (prefixMatch && prefixMatch[1]) {
    return prefixMatch[1].trim();
  }

  // 2. Strip standard conversational prefixes
  let cleaned = converted
    .replace(/^(?:my\s*(?:player\s*)?(?:uid|id)\s*(?:is)?|amar\s*(?:uid|id|player\s*id)|আমার\s*(?:আইডি|প্লেয়ার\s*আইডি|প্লেয়ার\s*আইডি|ইউআইডি))\s*[:=\-_]?\s*/i, '')
    .replace(/^(?:player\s*uid|player\s*id|playerid|uid|id|account|acc|আইডি|ইউআইডি)[\s:=#\-_]*/i, '')
    .replace(/[()[\]{}'"`]/g, ' ')
    .trim();

  // 3. If there is a sequence of 5-15 digits at the start (e.g. "5875547 (nick)" -> "5875547")
  const leadingDigits = cleaned.match(/^(\d{5,15})\b/);
  if (leadingDigits) {
    return leadingDigits[1];
  }

  // 4. If first token is valid (e.g. "player#1234" or "user@gmail.com")
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length > 0) {
    const candidate = tokens[0];
    if (candidate.length >= 3) {
      return candidate.trim();
    }
  }

  return (cleaned || converted).trim();
}

export interface ExtractedPayment {
  paymentMethod: string;
  trxId: string;
}

/**
 * Extract clean Payment Method, TrxID or Last 4 Digits from user payment confirmation text
 */
export function extractPaymentProof(rawText: string): ExtractedPayment {
  if (!rawText) {
    return { paymentMethod: 'BKASH/NAGAD/ROCKET', trxId: 'N/A' };
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

  // 2. Explicit TrxID patterns (e.g. "TrxID: BLA8392019", "Trx: 9J38A10982", "TX ID: ...", "trx id ...")
  const trxMatch = text.match(
    /(?:trx\s*id|trx|tx\s*id|txid|transaction\s*id|trans\s*id|ট্রানজেকশন\s*আইডি|টিএক্স\s*আইডি|টিএক্স)[\s:=#\-_]*([a-zA-Z0-9]{5,20})/i
  );
  if (trxMatch && trxMatch[1]) {
    return {
      paymentMethod,
      trxId: trxMatch[1].trim().toUpperCase()
    };
  }

  // 3. Explicit Last 4 Digits patterns (e.g. "last no 7647", "last 4 digit 7647", "লাস্ট ৪ ডিজিট ৭৬৪৭", "last 7647", "last number 7647")
  const lastDigitsMatch = text.match(
    /(?:last\s*(?:4\s*)?(?:digit|digits|no|num|number|code|সংখ্যার?|ডিজিট|নম্বর)?|লাস্ট\s*(?:৪\s*)?(?:ডিজিট|সংখ্যা|নম্বর)?)[\s:=#\-_]*([0-9]{3,8})/i
  );
  if (lastDigitsMatch && lastDigitsMatch[1]) {
    return {
      paymentMethod,
      trxId: lastDigitsMatch[1].trim()
    };
  }

  // 4. Standard bKash/Nagad TrxID alphanumeric formats (8-12 alphanumeric characters containing letters and numbers)
  const alphanumericTrx = text.match(/\b([A-Za-z0-9]{8,12})\b/);
  if (alphanumericTrx && /[0-9]/.test(alphanumericTrx[1]) && /[a-zA-Z]/.test(alphanumericTrx[1])) {
    return {
      paymentMethod,
      trxId: alphanumericTrx[1].trim().toUpperCase()
    };
  }

  // 5. BD Phone numbers (11 digits e.g. 01712345678 or 01872239597)
  const phoneMatch = text.match(/\b(01[3-9]\d{8})\b/);
  if (phoneMatch) {
    return {
      paymentMethod,
      trxId: phoneMatch[1].trim()
    };
  }

  // 6. Standalone 4-8 digit number (e.g. "7647", "send korsi 7647")
  const digitMatch = text.match(/\b(\d{4,8})\b/);
  if (digitMatch) {
    return {
      paymentMethod,
      trxId: digitMatch[1].trim()
    };
  }

  // 7. Strip stopwords / conversational noise and return the leftover trimmed token
  const cleaned = text
    .replace(/(?:bkash|nagad|rocket|upay|বিকাশ|নগদ|রকেট|উপায়|send|money|koresi|koreci|korsi|diasi|dici|done|taka|pathaisi|pathano|hoise|last|no|digit|number|লাস্ট|টাকা|পাঠিয়েছি|পাঠাইছি)/gi, ' ')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const finalTrx = cleaned || text;
  return {
    paymentMethod,
    trxId: finalTrx.slice(0, 30).trim()
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

