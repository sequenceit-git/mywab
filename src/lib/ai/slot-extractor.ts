import { ConversationSessionState, ConversationDraftOrder } from '@/types';

export interface ExtractedSlots {
  extractedUid: string | null;
  extractedUids?: string[];
  extractedTrx: string | null;
  extractedPaymentMethod: string | null;
  hasPaidIntent?: boolean;
  extractedItems: Array<{ skuOrName: string; quantity: number }> | null;
  parallelOrders?: Array<{
    playerUid: string;
    items: Array<{ skuOrName: string; quantity: number }>;
  }>;
}

export function normalizeBengaliDigits(str: string): string {
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return str.replace(/[০-৯]/g, d => String(bengaliDigits.indexOf(d)));
}

/**
 * Extract all potential PUBG Player UIDs from text (5 to 12 digits)
 */
export function extractAllUids(messageText: string): string[] {
  const normalizedText = normalizeBengaliDigits(messageText);
  const uids: string[] = [];
  const regex = /(?:uid|id|আইডি|player\s*uid|account)[:\s]*(\d{5,12})|\b(5\d{7,10})\b|\b(\d{7,11})\b/gi;
  let match;
  while ((match = regex.exec(normalizedText)) !== null) {
    const val = match[1] || match[2] || match[3];
    if (val && !uids.includes(val)) {
      uids.push(val);
    }
  }
  return uids;
}

export function extractSlotsFromMessage(messageText: string): ExtractedSlots {
  const normalizedText = normalizeBengaliDigits(messageText);
  const lower = normalizedText.toLowerCase().trim();

  // 1. Extract Player UIDs
  const allUids = extractAllUids(normalizedText);
  const extractedUid = allUids.length > 0 ? allUids[0] : null;

  // 2. Extract Payment Transaction ID (TrxID / 4-16 alphanumeric characters / last 4 digits)
  const explicitTrxMatch = 
    messageText.match(/(?:trxid|trnx|txid|tx\s*id|transaction|tr\s*id|ট্রানজেকশন|ট্রানস্যাকশন|trx)[:\s]*([a-zA-Z0-9]{4,16})/i) ||
    messageText.match(/(?:last|লাস্ট|শেষ)[:\s]*(\d{4,8})/i);

  let extractedTrx: string | null = explicitTrxMatch ? explicitTrxMatch[1].trim() : null;

  // Fallback standalone token: Only if alphanumeric containing digits AND not matching common conversational words
  if (!extractedTrx) {
    const trimmed = messageText.trim();
    const isAlphanumericCode = /^[a-zA-Z0-9]{4,16}$/.test(trimmed) && /\d/.test(trimmed);
    if (isAlphanumericCode && !allUids.includes(trimmed)) {
      const lowerToken = trimmed.toLowerCase();
      const ignoredWords = [
        'hello', 'bhai', 'acen', 'vaiya', 'koto', 'nibo', 'taka', 'send', 'koreci', 'korechi',
        'dam', 'rate', 'price', 'clear', 'reset', 'cancel', 'start', 'prime', 'plus', 'growth',
        'pack', 'order', 'track', 'status', 'thanks', 'dhonnobad', 'please', 'admin', 'button',
        'website', 'discount', 'account', 'number', 'payment'
      ];
      if (!ignoredWords.includes(lowerToken)) {
        extractedTrx = trimmed;
      }
    }
  }

  // Ensure extractedTrx does not match any extracted UIDs
  if (extractedTrx && allUids.includes(extractedTrx)) {
    extractedTrx = null;
  }

  // 3. Extract Payment Method & Paid Intent
  let extractedPaymentMethod: string | null = null;
  if (/(?:bkash|baksh|bikash|b-kash|বিকাশ)/i.test(lower)) extractedPaymentMethod = 'BKASH';
  else if (/(?:nagad|nogod|নগদ)/i.test(lower)) extractedPaymentMethod = 'NAGAD';
  else if (/(?:rocket|roket|রকেট)/i.test(lower)) extractedPaymentMethod = 'ROCKET';

  const hasPaidIntent = /(?:send\s*kore|send\s*kori|taka\s*di|taka\s*path|paid|pay\s*kore|টাকা\s*দিয়েছি|টাকা\s*পাঠিয়েছি|টাকা\s*দিছি|সেন্ড\s*করেছি|পাঠাইছি)/i.test(lower);

  // 4. Extract Package Intent
  let extractedItems: Array<{ skuOrName: string; quantity: number }> | null = null;
  const validUcAmounts = [60, 120, 180, 325, 385, 660, 720, 1045, 1800, 3850, 8100];
  const ucMatches = Array.from(normalizedText.matchAll(/(\d{2,4})\s*(?:uc|ইউসি)/gi));
  const filteredUc = ucMatches.filter(m => {
    const num = parseInt(m[1], 10);
    return validUcAmounts.includes(num);
  });

  if (filteredUc.length > 0) {
    extractedItems = filteredUc.map(m => ({ skuOrName: `${m[1]} UC`, quantity: 1 }));
  } else if (lower.includes('growth pack 1') || lower.includes('গ্রোথ প্যাক ১')) {
    extractedItems = [{ skuOrName: 'Growth Pack 1', quantity: 1 }];
  } else if (lower.includes('growth pack 2') || lower.includes('গ্রোথ প্যাক ২')) {
    extractedItems = [{ skuOrName: 'Growth Pack 2', quantity: 1 }];
  } else if (lower.includes('growth pack 3') || lower.includes('গ্রোথ প্যাক ৩')) {
    extractedItems = [{ skuOrName: 'Growth Pack 3', quantity: 1 }];
  } else if (lower.includes('prime plus') || lower.includes('প্রাইম প্লাস')) {
    extractedItems = [{ skuOrName: 'Prime Plus 1 Month', quantity: 1 }];
  } else if (lower.includes('prime') || lower.includes('প্রাইম')) {
    extractedItems = [{ skuOrName: 'Prime 1 Month', quantity: 1 }];
  }

  // 5. Multi-UID / Parallel Order Association
  let parallelOrders: Array<{ playerUid: string; items: Array<{ skuOrName: string; quantity: number }> }> | undefined = undefined;
  if (allUids.length > 1) {
    parallelOrders = allUids.map((uid, idx) => {
      const item = (extractedItems && extractedItems[idx]) || extractedItems?.[0] || { skuOrName: '60 UC', quantity: 1 };
      return {
        playerUid: uid,
        items: [item]
      };
    });
  }

  return {
    extractedUid,
    extractedUids: allUids,
    extractedTrx,
    extractedPaymentMethod,
    hasPaidIntent,
    extractedItems,
    parallelOrders
  };
}

export function isAffirmativePhrase(messageText: string): boolean {
  const lower = messageText.toLowerCase().trim();
  const affirmativeExactOrRegex = [
    /^(?:yes|ha|haa|ji|all\s*ok(?:ey)?|ok(?:ey|ay)?|confirm(?:ed)?|plz\s*confirm|please\s*confirm|proceed|done|paid)$/i,
    /^(?:thik\s*ase|thik\s*ache|thik|yes\s*please|yes\s*go\s*ahead|all\s*order\s*confirm|duto\s*e\s*confirm|ager\s*ta|ager\s*tai|ager\s*uid|ager\s*uide)$/i,
    /(?:^|\s)(?:ha|haa|yes|ji)?\s*(?:ager\s*ta|ager\s*tai|ager\s*uid|ager\s*uide)(?:$|\s)/i,
    /(?:^|\s)(?:হ্যাঁ|হ্যা|হাঁ|জি|ঠিক আছে|কনফার্ম|কনফার্ম করুন|টাকা পাঠিয়েছি|টাকা দিছি|অর্ডার করুন|অর্ডার দিন|এগিয়ে যান|অর্ডার কনফার্ম|সবগুলো কনফার্ম|আগেরটা|আগেরটায়|আগেরটাতে|আগের আইডিতে)(?:$|\s)/i
  ];
  return affirmativeExactOrRegex.some(regex => regex.test(lower));
}

export function isResetIntent(messageText: string): boolean {
  const lower = messageText.toLowerCase().trim();
  const resetKeywords = [
    'clear', 'reset', 'cancel', 'start', 'বাতিল', 'ক্লিয়ার', 'নতুন অর্ডার', 'start over', 'restart'
  ];
  return resetKeywords.includes(lower) || /^(?:cancel|clear|reset|বাতিল\s*করুন)$/i.test(lower);
}

