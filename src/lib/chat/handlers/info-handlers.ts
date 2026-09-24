import { db } from '../../db';
import { whatsappService } from '../../whatsapp/service';
import { OrderItem } from '@/types';
import { getAccountFieldInfo, getGameDeliveryConfig } from '../input-parser';

export async function handleTrackOrder(phone: string, conversationId: string, triggerId: string, rawText: string): Promise<void> {
  let orderIdCode = '';
  if (triggerId.startsWith('track:')) {
    orderIdCode = triggerId.replace('track:', '').trim();
  } else {
    const match = rawText.match(/WAP-\d+-\d+/i) || rawText.match(/\b\d{4,}\b/);
    if (match) orderIdCode = match[0];
  }

  if (!orderIdCode) {
    const buttons = [
      { id: 'btn_main_menu', title: '🎮 সব সার্ভিস ও গেম' }
    ];
    await whatsappService.sendInteractiveButtons(
      phone,
      '📦 আপনার অর্ডার ট্র্যাক করতে আপনার *Order ID* (যেমন: `WAP-20260918-1234`) লিখে পাঠান:',
      buttons,
      'অর্ডার ট্র্যাকিং'
    );
    return;
  }

  const order = await db.getOrderByCode(orderIdCode);
  if (!order) {
    const buttons = [
      { id: 'btn_main_menu', title: '🎮 সব সার্ভিস ও গেম' }
    ];
    await whatsappService.sendInteractiveButtons(
      phone,
      `❌ *${orderIdCode}* নম্বরের কোনো অর্ডার পাওয়া যায়নি। দয়া করে সঠিক Order ID দিন অথবা সব সার্ভিস দেখতে নিচে চাপ দিন:`,
      buttons,
      'অর্ডার পাওয়া যায়নি'
    );
    return;
  }

  const firstItem = order.items?.[0];
  const gameTitle = 
    order.customer_notes?.match(/Game:\s*([^|\n]+)/i)?.[1]?.trim() || 
    firstItem?.product_name || 
    '';
  const playerUid = order.player_uid || order.delivery_address?.name || 'N/A';
  const accountInfo = getAccountFieldInfo(playerUid, gameTitle);
  const deliveryConfig = getGameDeliveryConfig(gameTitle, firstItem?.product_name);

  const statusMap: Record<string, string> = {
    'PENDING': '⏳ পেন্ডিং (অর্ডার জমা হয়েছে)',
    'PENDING_CLAIM': '⏳ পেন্ডিং (প্রসেসিং শুরু হওয়ার অপেক্ষায়)',
    'CLAIMED': '⚡ প্রসেসিং চলছে (কর্মী কাজ করছেন)',
    'PROCESSING': '⚡ প্রসেসিং চলছে',
    'DELIVERED': '✅ সম্পন্ন হয়েছে (ডেলিভারি সম্পন্ন)',
    'COMPLETED': '✅ সম্পন্ন হয়েছে',
    'CANCELLED': '❌ বাতিল করা হয়েছে'
  };

  const statusText = statusMap[order.status] || order.status;
  const itemsList = order.items?.map((i: OrderItem) => `• ${i.product_name} x ${i.quantity}`).join('\n') || 'টপ-আপ প্যাকেজ';

  const fullOrderContext = `${gameTitle} ${itemsList} ${order.customer_notes || ''}`.toLowerCase();
  const isEfootball =
    fullOrderContext.includes('efootball') ||
    fullOrderContext.includes('efb') ||
    fullOrderContext.includes('konami');

  let deliveredText = '🎉 আপনার অ্যাকাউন্টে টপ-আপ পৌঁছে দেওয়া হয়েছে!';
  if (isEfootball) {
    deliveredText = '🎉 আপনার টপ-আপ সফলভাবে সম্পন্ন হয়েছে!\n🔒 *নিরাপত্তার জন্য আপনি অবশ্যই আপনার পাসওয়ার্ড পরিবর্তন করে নিবেন।*';
  } else if (accountInfo.isEmail) {
    deliveredText = '🎉 আপনার সাবস্ক্রিপশন সফলভাবে চালু করা হয়েছে!';
  }

  const message = 
`📦 *অর্ডার স্ট্যাটাস (Order Status):*

• *Order ID:* \`${order.order_id}\`
• *স্ট্যাটাস:* ${statusText}
• *${accountInfo.labelBn}:* \`${playerUid}\`
• *প্যাকেজ:*
${itemsList}
• *মূল্য:* ৳${order.total_amount} Tk

${order.status === 'DELIVERED' ? deliveredText : '⚡ আমাদের টিম দ্রুত ডেলিভারি দিতে কাজ করছে (৫-১৫ মিনিট)।'}`;

  const buttons = [
    { id: 'btn_main_menu', title: '🎮 সব সার্ভিস ও গেম' },
    { id: 'btn_website', title: '🌐 ওয়েবসাইট (২% ছাড়)' }
  ];

  await whatsappService.sendInteractiveButtons(phone, message, buttons, 'DS Dukan Tracker');
}

/**
 * Send Website Info
 */
export async function sendWebsiteInfo(phone: string, conversationId: string): Promise<void> {
  const text = 
`🌐 *DS Dukan Official Website:*
https://www.dsdukan.com/#

🎁 ওয়েবসাইটে সরাসরি অর্ডার করলে পাচ্ছেন *২% ইনস্ট্যান্ট ডিসকাউন্ট* এবং সাথে সাথে ডেলিভারি!`;

  const buttons = [
    { id: 'btn_main_menu', title: '🎮 সব সার্ভিস ও গেম' }
  ];

  await whatsappService.sendInteractiveButtons(phone, text, buttons, 'DS Dukan Website');
}

/**
 * Handle Customer Gratitude, Appreciation, Pleasantries or Acknowledgements
 */
export async function handleGratitude(phone: string, conversationId: string, customerName?: string): Promise<void> {
  db.setSessionState(conversationId, {
    step: 'IDLE'
  });

  const nameGreeting = customerName ? ` *${customerName}*` : '';
  const text = 
`❤️ *আপনাকে অসংখ্য ধন্যবাদ${nameGreeting}!*

DS Dukan এর সাথে থাকার জন্য কৃতজ্ঞ। আপনার যেকোনো গেম টপ-আপ, সাবস্ক্রিপশন বা প্রয়োজনে আমরা সবসময় পাশে আছি। ✨

🌐 আমাদের ওয়েবসাইটে সরাসরি অর্ডারে পাবেন *২% ইনস্ট্যান্ট ছাড়*!
🎮 নতুন অর্ডার করতে নিচের বাটনে চাপ দিন:`;

  const buttons = [
    { id: 'btn_main_menu', title: '🎮 সব সার্ভিস ও গেম' },
    { id: 'btn_website', title: '🌐 ওয়েবসাইট (২% ছাড়)' },
    { id: 'btn_track_order', title: '📦 অর্ডার ট্র্যাক' }
  ];

  await whatsappService.sendInteractiveButtons(phone, text, buttons, 'DS Dukan Assistant');

  await db.addMessage({
    conversationId,
    sender: 'BOT',
    content: text,
    metadata: { type: 'GRATITUDE_REPLY' }
  });
}

/**
 * Reassure customer about delivery time / processing queue
 */
export async function handleStatusInquiry(phone: string, conversationId: string): Promise<void> {
  const text = 
`⚡ *আপনার অর্ডারটি প্রসেসিং কিউতে রয়েছে!*

আমাদের টপ-আপ টিম দ্রুততম সময়ে (সাধারণত ৫–১৫ মিনিটের মধ্যে) টপ-আপ সম্পন্ন করে আপনার অ্যাকাউন্টে পাঠিয়ে দেবে। 🚀

ডেলিভারি সম্পন্ন হওয়ামাত্র আপনি হোয়াটসঅ্যাপে নিশ্চিতকরণ মেসেজ পাবেন।`;

  const buttons = [
    { id: 'btn_track_order', title: '📦 অর্ডার ট্র্যাক' },
    { id: 'btn_main_menu', title: '🎮 সব সার্ভিস ও গেম' }
  ];

  await whatsappService.sendInteractiveButtons(phone, text, buttons, 'DS Dukan Support');

  await db.addMessage({
    conversationId,
    sender: 'BOT',
    content: text,
    metadata: { type: 'STATUS_INQUIRY_REPLY' }
  });
}

/**
 * Help & Slash Command guide
 */
export async function sendHelpInfo(phone: string, conversationId: string): Promise<void> {
  const text = 
`ℹ️ *DS Dukan — কমান্ড ও সহায়তা নির্দেশিকা (Commands & Guide)*

আমাদের সাথে যেকোনো সময় সহজে ইন্টারঅ্যাক্ট করতে নিচের কমান্ডগুলো ব্যবহার করতে পারেন:

📌 *বেসিক কমান্ডসমূহ:*
• */menu* বা */start* : সব গেম ও সার্ভিসের তালিকা
• */track [OrderID]* : লাইভ অর্ডার স্ট্যাটাস চেক
• */human* : সরাসরি হিউম্যান সাপোর্ট এজেন্টের সাথে যোগাযোগ
• */bot* : অটোমেটিক বট পুনরায় সক্রিয় করুন
• */cancel* : চলমান অর্ডার বাতিল ও মেনুতে ফিরে যাওয়া
• */website* : অফিশিয়াল ওয়েবসাইট (২% ইনস্ট্যান্ট ছাড়)
• */help* : সহায়তা ও কমান্ড লিস্ট

🎮 *সার্ভিস শর্টকাট:*
• */pubg* : PUBG Mobile UC প্রাইস ও টপ-আপ
• */ff* : Free Fire Diamond প্রাইস ও টপ-আপ
• */movie* : Netflix, Crunchyroll, Spotify সাবস্ক্রিপশন
• */efootball* : eFootball Coins প্রাইস ও টপ-আপ

📞 কোনো সমস্যা বা সহায়তার জন্য আমাদের ইনবক্সে সরাসরি লিখুন বা */human* পাঠান।`;

  const buttons = [
    { id: 'btn_main_menu', title: '🎮 সব সার্ভিস ও গেম' },
    { id: 'btn_human_support', title: '👤 হিউম্যান সাপোর্ট' },
    { id: 'btn_track_order', title: '📦 অর্ডার ট্র্যাক' }
  ];

  await whatsappService.sendInteractiveButtons(phone, text, buttons, 'DS Dukan Help');

  await db.addMessage({
    conversationId,
    sender: 'BOT',
    content: text,
    metadata: { type: 'HELP_INFO' }
  });
}

/**
 * Handle /human command or request to speak with a human agent
 */
export async function handleHumanSupportRequest(
  phone: string,
  conversationId: string,
  customerName?: string,
  rawText?: string
): Promise<void> {
  console.log(`[Human Support] Initiating human takeover for phone=${phone} conv=${conversationId}`);

  // 1. Immediately dispatch alert to Telegram Worker Group
  try {
    const { telegramBot } = await import('../../telegram/bot');
    const alertOk = await telegramBot.notifyHumanSupportRequest({
      phone,
      customerName,
      messageText: rawText,
      conversationId
    });
    console.log(`[Human Support] Telegram alert sent: ${alertOk}`);
  } catch (tgErr) {
    console.error('[Telegram Alert Error in handleHumanSupportRequest]:', tgErr);
  }

  // 2. Turn off AI Bot for this conversation (Human Takeover mode)
  try {
    await db.setAiMode(conversationId, false);
  } catch (err) {
    console.error('[SetAiMode Error]:', err);
  }

  // 3. Send confirmation WhatsApp message to customer
  const nameGreeting = customerName ? ` *${customerName}*` : '';
  const text = 
`👤 *হিউম্যান সাপোর্ট এজেন্টের সাথে কানেক্ট করা হচ্ছে${nameGreeting}...*

আমাদের কাস্টমার সাপোর্ট টিমকে অবগত করা হয়েছে। খুব শীঘ্রই একজন এজেন্ট আপনার সাথে এই চ্যাটে সরাসরি যুক্ত হবেন। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন। 🤝

_(বট সাময়িকভাবে বন্ধ রাখা হয়েছে। পুনরায় অটোমেটিক বট চালু করতে */bot* বা */menu* লিখুন)_`;

  const buttons = [
    { id: 'btn_main_menu', title: '🤖 বট অন করুন' },
    { id: 'btn_website', title: '🌐 ওয়েবসাইট' }
  ];

  try {
    await whatsappService.sendInteractiveButtons(phone, text, buttons, 'Human Support');
  } catch (waErr) {
    console.warn('[WhatsApp Button Error, fallback to text]:', waErr);
    await whatsappService.sendMessage(phone, text);
  }

  // 4. Save to database
  await db.addMessage({
    conversationId,
    sender: 'BOT',
    content: text,
    metadata: { type: 'HUMAN_SUPPORT_TAKEOVER' }
  });
}

/**
 * Handle Refusal, Cancellation or Change of mind gracefully
 */
export async function handleCancellation(phone: string, conversationId: string, customerName?: string): Promise<void> {
  db.clearSessionDraft(conversationId);
  db.setSessionState(conversationId, {
    step: 'IDLE'
  });

  const nameGreeting = customerName ? ` *${customerName}*` : '';
  const text = 
`👍 *ঠিক আছে${nameGreeting}, কোনো সমস্যা নেই!*

আপনার যখনই কোনো গেম টপ-আপ বা সাবস্ক্রিপশন (PUBG, Free Fire, Netflix ইত্যাদি) প্রয়োজন হবে, আমাদের জানাতে পারেন। 🤝✨

🌐 আমাদের ওয়েবসাইটে সরাসরি অর্ডারে রয়েছে *২% ইনস্ট্যান্ট ডিসকাউন্ট*!
🎮 যেকোনো সময় সার্ভিস দেখতে নিচের বাটনে চাপ দিন:`;

  const buttons = [
    { id: 'btn_main_menu', title: '🎮 সব সার্ভিস ও গেম' },
    { id: 'btn_website', title: '🌐 ওয়েবসাইট (২% ছাড়)' },
    { id: 'btn_help', title: 'ℹ️ সহায়তা' }
  ];

  await whatsappService.sendInteractiveButtons(phone, text, buttons, 'DS Dukan Assistant');

  await db.addMessage({
    conversationId,
    sender: 'BOT',
    content: text,
    metadata: { type: 'CANCELLATION_REPLY' }
  });
}

