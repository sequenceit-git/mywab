import { ConversationSessionState } from '@/types';

export interface ExtractedSlots {
  extractedUid: string | null;
  extractedTrx: string | null;
  extractedPaymentMethod: string | null;
  extractedItems: Array<{ skuOrName: string; quantity: number }> | null;
}

export function extractSlotsFromMessage(messageText: string): ExtractedSlots {
  const lower = messageText.toLowerCase().trim();

  // 1. Extract Player UID (5-12 numeric characters or explicitly formatted as UID: 5123456789)
  const uidMatch = messageText.match(/(?:uid|id|আইডি)[:\s]+(\d{5,12})/i) ||
                   messageText.match(/\b(5\d{7,10})\b/) ||
                   messageText.match(/\b(\d{8,11})\b/);
  const extractedUid = uidMatch ? uidMatch[1] : null;

  // 2. Extract Payment Transaction ID (TrxID / 8-10 alphanumeric characters / last 4 digits)
  const trxMatch = messageText.match(/(?:trx|trxid|trnx|txid|id)[:\s]*([a-z0-9]{6,12})/i) ||
                   messageText.match(/\b([A-Z0-9]{8,10})\b/) ||
                   messageText.match(/(?:last|লাস্ট)[:\s]*(\d{4})/i);
  const extractedTrx = (trxMatch && trxMatch[1].toUpperCase() !== extractedUid) ? trxMatch[1] : null;

  // 3. Extract Payment Method
  let extractedPaymentMethod: string | null = null;
  if (lower.includes('bkash') || lower.includes('বিকাশ')) extractedPaymentMethod = 'BKASH';
  else if (lower.includes('nagad') || lower.includes('নগদ')) extractedPaymentMethod = 'NAGAD';
  else if (lower.includes('rocket') || lower.includes('রকেট')) extractedPaymentMethod = 'ROCKET';

  // 4. Extract Package Intent
  let extractedItems: Array<{ skuOrName: string; quantity: number }> | null = null;
  const ucMatch = messageText.match(/(\d{2,4})\s*(?:uc|ইউসি)/i);
  if (ucMatch) {
    extractedItems = [{ skuOrName: `${ucMatch[1]} UC`, quantity: 1 }];
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

  return {
    extractedUid,
    extractedTrx,
    extractedPaymentMethod,
    extractedItems
  };
}

export function isAffirmativePhrase(messageText: string): boolean {
  const lower = messageText.toLowerCase().trim();
  const affirmativePhrases = [
    'yes', 'all okey', 'all ok', 'okey', 'ok', 'okay',
    'confirm', 'confirmed', 'plz confirm', 'please confirm', 'proceed', 'done', 'paid',
    'thik ase', 'thik ache', 'thik', 'yes please', 'yes go ahead',
    'হ্যাঁ', 'হ্যা', 'ঠিক আছে', 'কনফার্ম', 'কনফার্ম করুন', 'টাকা পাঠিয়েছি', 'টাকা দিছি', 'অর্ডার করুন', 'অর্ডার দিন', 'এগিয়ে যান', 'অর্ডার কনফার্ম'
  ];
  return affirmativePhrases.some(phrase => lower === phrase || lower.includes(phrase));
}
