import { ConversationSessionState, ConversationDraftOrder } from '@/types';

export interface ExtractedSlots {
  extractedUid: string | null;
  extractedUids?: string[];
  extractedTrx: string | null;
  extractedPaymentMethod: string | null;
  extractedItems: Array<{ skuOrName: string; quantity: number }> | null;
  parallelOrders?: Array<{
    playerUid: string;
    items: Array<{ skuOrName: string; quantity: number }>;
  }>;
}

/**
 * Extract all potential PUBG Player UIDs from text (5 to 12 digits)
 */
export function extractAllUids(messageText: string): string[] {
  const uids: string[] = [];
  const regex = /(?:uid|id|আইডি)[:\s]*(\d{5,12})|\b(5\d{7,10})\b|\b(\d{8,11})\b/gi;
  let match;
  while ((match = regex.exec(messageText)) !== null) {
    const val = match[1] || match[2] || match[3];
    if (val && !uids.includes(val)) {
      uids.push(val);
    }
  }
  return uids;
}

export function extractSlotsFromMessage(messageText: string): ExtractedSlots {
  const lower = messageText.toLowerCase().trim();

  // 1. Extract Player UIDs
  const allUids = extractAllUids(messageText);
  const extractedUid = allUids.length > 0 ? allUids[0] : null;

  // 2. Extract Payment Transaction ID (TrxID / 6-12 alphanumeric characters / last 4 digits)
  const trxMatch = messageText.match(/(?:trx|trxid|trnx|txid|id)[:\s]*([a-z0-9]{6,12})/i) ||
                   messageText.match(/\b([A-Z0-9]{8,10})\b/) ||
                   messageText.match(/(?:last|লাস্ট)[:\s]*(\d{4})/i);
  
  // Ensure extractedTrx does not match any extracted UIDs
  const matchedTrxVal = trxMatch ? trxMatch[1].toUpperCase() : null;
  const extractedTrx = (matchedTrxVal && !allUids.includes(matchedTrxVal)) ? matchedTrxVal : null;

  // 3. Extract Payment Method
  let extractedPaymentMethod: string | null = null;
  if (lower.includes('bkash') || lower.includes('বিকাশ')) extractedPaymentMethod = 'BKASH';
  else if (lower.includes('nagad') || lower.includes('নগদ')) extractedPaymentMethod = 'NAGAD';
  else if (lower.includes('rocket') || lower.includes('রকেট')) extractedPaymentMethod = 'ROCKET';

  // 4. Extract Package Intent
  let extractedItems: Array<{ skuOrName: string; quantity: number }> | null = null;
  const ucMatches = Array.from(messageText.matchAll(/(\d{2,4})\s*(?:uc|ইউসি)/gi));
  if (ucMatches.length > 0) {
    extractedItems = ucMatches.map(m => ({ skuOrName: `${m[1]} UC`, quantity: 1 }));
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
    extractedItems,
    parallelOrders
  };
}

export function isAffirmativePhrase(messageText: string): boolean {
  const lower = messageText.toLowerCase().trim();
  const affirmativePhrases = [
    'yes', 'all okey', 'all ok', 'okey', 'ok', 'okay',
    'confirm', 'confirmed', 'plz confirm', 'please confirm', 'proceed', 'done', 'paid',
    'thik ase', 'thik ache', 'thik', 'yes please', 'yes go ahead', 'all order confirm', 'duto e confirm',
    'হ্যাঁ', 'হ্যা', 'ঠিক আছে', 'কনফার্ম', 'কনফার্ম করুন', 'টাকা পাঠিয়েছি', 'টাকা দিছি', 'অর্ডার করুন', 'অর্ডার দিন', 'এগিয়ে যান', 'অর্ডার কনফার্ম', 'সবগুলো কনফার্ম'
  ];
  return affirmativePhrases.some(phrase => lower === phrase || lower.includes(phrase));
}
