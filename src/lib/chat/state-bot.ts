import { db } from '@/lib/db';
import { whatsappService } from '@/lib/whatsapp/service';
import { telegramBot } from '@/lib/telegram/bot';
import { GAME_CATEGORIES, GameCategory, GamePackage, PAYMENT_ACCOUNTS, findGameCategory, findPackage, formatWhatsAppRow, formatWhatsAppButton } from './game-catalog';
import { extractCleanUid, extractPaymentProof, getAccountFieldInfo, getGameDeliveryConfig, isGratitudeOrPleasantry, isStatusInquiry, isGreetingOrMenu } from './input-parser';
import { ConversationSessionState, OrderItem } from '@/types';

export interface IncomingEvent {
  conversationId: string;
  userId: string;
  phone: string;
  customerName?: string;
  text?: string;
  buttonId?: string;
  listId?: string;
}

export const stateBot = {
  /**
   * Main entry point for processing incoming WhatsApp events deterministically
   */
  async handleIncomingMessage(event: IncomingEvent): Promise<void> {
    const { conversationId, userId, phone, customerName } = event;
    const triggerId = (event.listId || event.buttonId || '').trim();
    const rawText = (event.text || '').trim();
    const normalizedText = rawText.toLowerCase();

    const session = db.getSessionState(conversationId);

    // 1. Gratitude, Acknowledgements & Pleasantries (e.g. "Thank you", "Nice", "Ok", "Done", "Peyechi", etc.)
    if (isGratitudeOrPleasantry(rawText)) {
      await this.handleGratitude(phone, conversationId, customerName);
      return;
    }

    // 2. Status inquiries ("order status", "status", "delivery status")
    if (isStatusInquiry(rawText)) {
      await this.handleStatusInquiry(phone, conversationId);
      return;
    }

    // 3. Greeting or Menu reset request ("Hi", "Hello", "Start", "Menu", "Restart")
    if (isGreetingOrMenu(rawText)) {
      await this.sendWelcomeAndGameList(phone, conversationId, customerName);
      return;
    }

    // 4. Quick-restart / Menu button clicked
    if (triggerId === 'btn_menu' || triggerId === 'btn_restart' || triggerId === 'btn_change_game') {
      await this.sendWelcomeAndGameList(phone, conversationId, customerName);
      return;
    }

    // 5. Payment method buttons / selection
    if (
      triggerId.startsWith('pay_') ||
      (session.step === 'AWAITING_PAYMENT' && ['bkash', 'nagad', 'rocket', 'বিকাশ', 'নগদ', 'রকেট'].includes(normalizedText))
    ) {
      await this.handlePaymentMethodSelection(phone, conversationId, triggerId || rawText, session);
      return;
    }

    // 6. Check if trigger or text is selecting one of the game categories
    const matchedGame = findGameCategory(triggerId) || (session.step === 'SELECTING_GAME' || session.step === 'IDLE' ? findGameCategory(rawText) : undefined);
    if (matchedGame) {
      // Check if user also directly specified a package in the same message (e.g. "Netflix 1 month", "PUBG 60 UC")
      const directPackage = findPackage(matchedGame, rawText);
      if (directPackage) {
        await this.handlePackageSelection(phone, conversationId, matchedGame, directPackage);
        return;
      }
      await this.handleGameSelection(phone, conversationId, matchedGame);
      return;
    }

    // 7. Check if trigger or text is selecting a package for the currently selected game
    if (session.step === 'SELECTING_PACKAGE' || triggerId.startsWith('pkg_')) {
      const currentGame = session.draftOrder.selectedGame ? findGameCategory(session.draftOrder.selectedGame) : undefined;
      if (currentGame) {
        const matchedPackage = findPackage(currentGame, triggerId) || findPackage(currentGame, rawText);
        if (matchedPackage) {
          await this.handlePackageSelection(phone, conversationId, currentGame, matchedPackage);
          return;
        }
      }
    }

    // 8. Step-specific text input routing
    switch (session.step) {
      case 'COLLECTING_UID':
        await this.handleUidInput(phone, conversationId, rawText, session);
        break;

      case 'AWAITING_PAYMENT':
        await this.handleTrxIdInput(phone, conversationId, userId, rawText, session);
        break;

      case 'ORDER_PLACED':
        // Order completed previously, customer sent generic text
        await this.handleGratitude(phone, conversationId, customerName);
        break;

      case 'SELECTING_GAME':
        // User typed something unrecognized while game list is active
        await whatsappService.sendMessage(
          phone,
          '⚠️ অনুগ্রহ করে নিচের তালিকা থেকে আপনার পছন্দের গেমটি সিলেক্ট করুন।'
        );
        await this.sendGameList(phone, conversationId);
        break;

      case 'SELECTING_PACKAGE':
        // User typed something unrecognized while package selection is active
        const game = session.draftOrder.selectedGame ? findGameCategory(session.draftOrder.selectedGame) : undefined;
        if (game) {
          await whatsappService.sendMessage(
            phone,
            `⚠️ অনুগ্রহ করে *${game.fullName}* এর প্যাকেজগুলোর মধ্য থেকে একটি সিলেক্ট করুন:`
          );
          await this.sendPackageList(phone, conversationId, game);
        } else {
          await this.sendWelcomeAndGameList(phone, conversationId);
        }
        break;

      default:
        // Default / IDLE fallback
        await this.sendWelcomeAndGameList(phone, conversationId, customerName);
        break;
    }
  },

  /**
   * Send the initial Welcome message and 9-game selection list
   */
  async sendWelcomeAndGameList(phone: string, conversationId: string, customerName?: string): Promise<void> {
    db.setSessionState(conversationId, {
      step: 'SELECTING_GAME',
      draftOrder: { items: [] }
    });

    const nameGreeting = customerName ? ` *${customerName}*` : '';
    const welcomeHeader = '🎮 DS Dukan — Game Top-Up';
    const welcomeBody = 
`👋 আসসালামু আলাইকুম${nameGreeting}! DS Dukan-এ আপনাকে স্বাগতম।

🎮 *আমাদের সব গেম টপ-আপ এবং সাবস্ক্রিপশন সার্ভিস:*
নিচের মেনু থেকে আপনার কাঙ্ক্ষিত গেম বা সার্ভিসটি সিলেক্ট করুন। ডেলিভারি মাত্র ৫–১৫ মিনিটে! ⚡`;

    const sections = [
      {
        title: 'DS Dukan Game Catalog',
        rows: GAME_CATEGORIES.map(cat => ({
          id: cat.id,
          title: `${cat.emoji} ${cat.title}`,
          description: cat.fullName
        }))
      }
    ];

    await whatsappService.sendInteractiveList(
      phone,
      welcomeBody,
      'গেম বেছে নিন 🎮',
      sections,
      welcomeHeader,
      'DS Dukan — 24/7 Top-Up Assistant'
    );

    await db.addMessage({
      conversationId,
      sender: 'BOT',
      content: welcomeBody,
      metadata: { type: 'interactive_game_list' }
    });
  },

  /**
   * Resend only the game list
   */
  async sendGameList(phone: string, conversationId: string): Promise<void> {
    const sections = [
      {
        title: 'DS Dukan Games',
        rows: GAME_CATEGORIES.map(cat => ({
          id: cat.id,
          title: `${cat.emoji} ${cat.title}`,
          description: cat.fullName
        }))
      }
    ];

    await whatsappService.sendInteractiveList(
      phone,
      '🎮 *DS DUKAN — GAME TOP UP & SUBSCRIPTION*\n\nযেকোনো একটি গেম সিলেক্ট করুন:',
      'গেম সিলেক্ট করুন',
      sections,
      '🎮 গেম তালিকা',
      'DS Dukan Top-Up'
    );
  },

  /**
   * Step 1 -> Step 2: Handle game category choice and show price list + package options
   */
  async handleGameSelection(phone: string, conversationId: string, game: GameCategory): Promise<void> {
    db.setSessionState(conversationId, {
      step: 'SELECTING_PACKAGE',
      draftOrder: {
        items: [],
        selectedGame: game.code,
        selectedGameLabel: game.fullName
      }
    });

    await this.sendPackageList(phone, conversationId, game);
  },

  /**
   * Send the price list and package selection buttons / list for a specific game
   */
  async sendPackageList(phone: string, conversationId: string, game: GameCategory): Promise<void> {
    // Build price list text
    let priceListText = `🎮 *${game.fullName} — PRICE LIST*\n\n`;
    game.packages.forEach((pkg) => {
      priceListText += `• *${pkg.name}* : ৳${pkg.price} Tk\n`;
    });
    priceListText += `\n⚡ ডেলিভারি সময়: ৫–১৫ মিনিট\n🎁 ওয়েবসাইট থেকে কিনলে ২% ইনস্ট্যান্ট ডিসকাউন্ট!`;

    // If game has 3 or fewer packages, send interactive quick-reply buttons
    if (game.packages.length <= 3) {
      const buttons = game.packages.map(p => formatWhatsAppButton(p));

      await whatsappService.sendInteractiveButtons(
        phone,
        `${priceListText}\n\nআপনার প্যাকেজটি বেছে নিন:`,
        buttons,
        `${game.emoji} ${game.title}`,
        'DS Dukan'
      );
    } else {
      // If game has >3 packages, send an Interactive List Message (supports up to 10 rows)
      const sections = [
        {
          title: `${game.title} Packages`.slice(0, 24),
          rows: game.packages.slice(0, 10).map(pkg => formatWhatsAppRow(pkg))
        }
      ];

      await whatsappService.sendInteractiveList(
        phone,
        `${priceListText}\n\nনিচের বাটন থেকে আপনার কাঙ্ক্ষিত প্যাকেজটি সিলেক্ট করুন:`,
        'প্যাকেজ বেছে নিন 💎',
        sections,
        `${game.emoji} ${game.title}`,
        'DS Dukan'
      );
    }

    await db.addMessage({
      conversationId,
      sender: 'BOT',
      content: priceListText,
      metadata: { type: 'price_list', game: game.code }
    });
  },

  /**
   * Step 2 -> Step 3: Handle package choice and ask for UID / Player Info
   */
  async handlePackageSelection(
    phone: string,
    conversationId: string,
    game: GameCategory,
    pkg: GamePackage
  ): Promise<void> {
    db.setSessionState(conversationId, {
      step: 'COLLECTING_UID',
      draftOrder: {
        items: [{
          skuOrName: pkg.name,
          quantity: 1,
          unitPrice: pkg.price,
          productName: `${game.fullName} (${pkg.name})`
        }],
        totalAmount: pkg.price,
        selectedGame: game.code,
        selectedGameLabel: game.fullName
      }
    });

    const promptMessage = 
`✅ *সিলেক্টেড প্যাকেজ:* ${pkg.name}
💰 *মূল্য:* ৳${pkg.price} Tk

${game.inputPrompt}`;

    const buttons = [
      { id: 'btn_main_menu', title: '🔙 মেইন মেনু' }
    ];

    await whatsappService.sendInteractiveButtons(
      phone,
      promptMessage,
      buttons,
      'আইডি তথ্য দিন'
    );

    await db.addMessage({
      conversationId,
      sender: 'BOT',
      content: promptMessage,
      metadata: { step: 'COLLECTING_UID', package: pkg.name, price: pkg.price }
    });
  },

  /**
   * Step 3 -> Step 4: Validate UID input and display Payment summary + 1-Tap Method Selection Buttons
   */
  async handleUidInput(
    phone: string,
    conversationId: string,
    rawText: string,
    session: ConversationSessionState
  ): Promise<void> {
    const cleanUid = extractCleanUid(rawText);

    if (!cleanUid || cleanUid.length < 3) {
      await whatsappService.sendMessage(
        phone,
        '⚠️ আইডি বা প্রয়োজনীয় তথ্যটি সঠিক নয়। অনুগ্রহ করে আপনার সঠিক প্লেয়ার আইডি বা তথ্যটি লিখে পাঠান:'
      );
      return;
    }

    const item = session.draftOrder.items?.[0];
    const amount = session.draftOrder.totalAmount || item?.unitPrice || 0;
    const gameLabel = session.draftOrder.selectedGameLabel || 'গেম টপ-আপ';
    const pkgName = item?.skuOrName || 'প্যাকেজ';

    db.setSessionState(conversationId, {
      step: 'AWAITING_PAYMENT',
      draftOrder: {
        ...session.draftOrder,
        playerUid: cleanUid
      }
    });

    const accountInfo = getAccountFieldInfo(cleanUid, gameLabel);

    const paymentMessage = 
`📝 *অর্ডার সামারি:*
• গেম / সার্ভিস: *${gameLabel}*
• প্যাকেজ: *${pkgName}*
• ${accountInfo.emoji} ${accountInfo.labelBn}: \`${cleanUid}\`
• মোট মূল্য: *৳${amount} Tk*

💳 *পেমেন্ট নম্বরসমূহ (Personal Send Money / Cash In):*
• *bKash:* \`${PAYMENT_ACCOUNTS.bkash}\`
• *Nagad:* \`${PAYMENT_ACCOUNTS.nagad}\`
• *Rocket:* \`${PAYMENT_ACCOUNTS.rocket}\`

👇 *টাকা পাঠানোর জন্য নিচের মাধ্যম সিলেক্ট করুন:*`;

    const buttons = [
      { id: 'pay_bkash', title: '🟢 bKash' },
      { id: 'pay_nagad', title: '🟠 Nagad' },
      { id: 'pay_rocket', title: '🟣 Rocket' }
    ];

    await whatsappService.sendInteractiveButtons(
      phone,
      paymentMessage,
      buttons,
      'পেমেন্ট মাধ্যম বাছুন'
    );

    await db.addMessage({
      conversationId,
      sender: 'BOT',
      content: paymentMessage,
      metadata: { step: 'AWAITING_PAYMENT', playerUid: cleanUid, amount }
    });
  },

  /**
   * Handle Payment Method Selection (bKash, Nagad, Rocket)
   */
  async handlePaymentMethodSelection(
    phone: string,
    conversationId: string,
    methodInput: string,
    session: ConversationSessionState
  ): Promise<void> {
    let method = 'BKASH';
    let methodName = 'bKash (বিকাশ)';
    let accountNumber = PAYMENT_ACCOUNTS.bkash;

    const lower = methodInput.toLowerCase();
    if (lower.includes('nagad') || lower.includes('নগদ')) {
      method = 'NAGAD';
      methodName = 'Nagad (নগদ)';
      accountNumber = PAYMENT_ACCOUNTS.nagad;
    } else if (lower.includes('rocket') || lower.includes('রকেট')) {
      method = 'ROCKET';
      methodName = 'Rocket (রকেট)';
      accountNumber = PAYMENT_ACCOUNTS.rocket;
    }

    db.setSessionState(conversationId, {
      step: 'AWAITING_PAYMENT',
      draftOrder: {
        ...session.draftOrder,
        paymentMethod: method
      }
    });

    const item = session.draftOrder.items?.[0];
    const amount = session.draftOrder.totalAmount || item?.unitPrice || 0;
    const playerUid = session.draftOrder.playerUid || 'N/A';

    const guideMessage = 
`💳 *${methodName} পেমেন্ট নির্দেশিকা (Personal Send Money / Cash In)*

• একাউন্ট নম্বর: \`${accountNumber}\` *(ট্যাপ করে কপি করুন)*
• প্রদেয় টাকার পরিমাণ: *৳${amount} Tk*
• রেফারেন্স (যদি চায়): \`${playerUid}\`

👉 টাকা পাঠানোর পর আপনার *TrxID* অথবা নম্বরের *লাস্ট ৪ ডিজিট* লিখে মেসেজ পাঠান:`;

    const buttons = [
      { id: 'btn_main_menu', title: '❌ বাতিল করুন' }
    ];

    await whatsappService.sendInteractiveButtons(
      phone,
      guideMessage,
      buttons,
      'টাকা পাঠিয়ে TrxID দিন'
    );

    await db.addMessage({
      conversationId,
      sender: 'BOT',
      content: guideMessage,
      metadata: { step: 'AWAITING_PAYMENT', selectedMethod: method, accountNumber }
    });
  },

  /**
   * Step 4 -> Complete: Collect TrxID, create order in DB, send Order Confirmation, dispatch to Telegram
   */
  async handleTrxIdInput(
    phone: string,
    conversationId: string,
    userId: string,
    rawText: string,
    session: ConversationSessionState
  ): Promise<void> {
    const extracted = extractPaymentProof(rawText);
    const paymentMethod = (extracted.paymentMethod !== 'BKASH/NAGAD/ROCKET' ? extracted.paymentMethod : session.draftOrder.paymentMethod) || 'BKASH';
    const cleanTrx = extracted.rawProof;
    const item = session.draftOrder.items?.[0];
    const unitPrice = item?.unitPrice || session.draftOrder.totalAmount || 0;
    const productName = item?.productName || `${session.draftOrder.selectedGameLabel || 'Game'} (${item?.skuOrName || 'Top-Up'})`;
    const playerUid = session.draftOrder.playerUid || 'N/A';
    const accountInfo = getAccountFieldInfo(playerUid, session.draftOrder.selectedGameLabel);

    try {
      // 1. Create order in Database
      const order = await db.createOrder({
        userId,
        deliveryPhone: phone,
        playerUid,
        trxId: cleanTrx,
        paymentMethod,
        items: [
          {
            product_name: productName,
            unit_price: unitPrice,
            quantity: 1
          }
        ],
        customerNotes: `State Bot Order | Game: ${session.draftOrder.selectedGameLabel || 'N/A'} | ${accountInfo.labelEn}: ${playerUid} | Proof: ${cleanTrx} | Pay: ${paymentMethod}`
      });

      // 2. Clear draft and update session state
      db.clearSessionDraft(conversationId, order.order_id);
      db.setSessionState(conversationId, {
        step: 'ORDER_PLACED'
      });

      // 3. Dispatch new order to Telegram Worker Group for instant worker claim
      telegramBot.dispatchNewOrder(order).catch(err => {
        console.warn('[Telegram Worker Dispatch Warning]:', err);
      });

      // 4. Send WhatsApp structured order confirmation
      await whatsappService.sendOrderConfirmation(order);

      await db.addMessage({
        conversationId,
        sender: 'BOT',
        content: `🎉 অর্ডার #${order.order_id} সফলভাবে তৈরি হয়েছে।`,
        metadata: { orderId: order.order_id, step: 'ORDER_PLACED' }
      });
    } catch (err) {
      console.error('[StateBot handleTrxIdInput Error]:', err);
      await whatsappService.sendMessage(
        phone,
        '⚠️ অর্ডার প্রসেস করতে একটি সমস্যা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন অথবা আমাদের সরাসরি কল করুন।'
      );
    }
  },

  /**
   * Track order handler
   */
  async handleTrackOrder(phone: string, conversationId: string, triggerId: string, rawText: string): Promise<void> {
    let orderIdCode = '';
    if (triggerId.startsWith('track:')) {
      orderIdCode = triggerId.replace('track:', '').trim();
    } else {
      const match = rawText.match(/WAP-\d+-\d+/i) || rawText.match(/\b\d{4,}\b/);
      if (match) orderIdCode = match[0];
    }

    if (!orderIdCode) {
      await whatsappService.sendMessage(
        phone,
        '📦 আপনার অর্ডার ট্র্যাক করতে আপনার *Order ID* (যেমন: `WAP-20260918-1234`) লিখে পাঠান।'
      );
      return;
    }

    const order = await db.getOrderByCode(orderIdCode);
    if (!order) {
      await whatsappService.sendMessage(
        phone,
        `❌ *${orderIdCode}* নম্বরের কোনো অর্ডার পাওয়া যায়নি। দয়া করে সঠিক Order ID দিন।`
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

    const message = 
`📦 *অর্ডার স্ট্যাটাস (Order Status):*

• *Order ID:* \`${order.order_id}\`
• *স্ট্যাটাস:* ${statusText}
• *${accountInfo.labelBn}:* \`${playerUid}\`
• *প্যাকেজ:*
${itemsList}
• *মূল্য:* ৳${order.total_amount} Tk

${order.status === 'DELIVERED' ? (accountInfo.isEmail ? '🎉 আপনার সাবস্ক্রিপশন সফলভাবে চালু করা হয়েছে!' : '🎉 আপনার অ্যাকাউন্টে টপ-আপ পৌঁছে দেওয়া হয়েছে!') : '⚡ আমাদের টিম দ্রুত ডেলিভারি দিতে কাজ করছে (৫-১৫ মিনিট)।'}`;

    const buttons = [
      { id: deliveryConfig.catalogButtonId, title: deliveryConfig.catalogButtonTitle },
      { id: 'btn_website', title: '🌐 ওয়েবসাইট' }
    ];

    await whatsappService.sendInteractiveButtons(phone, message, buttons, 'DS Dukan Tracker');
  },

  /**
   * Send Website Info
   */
  async sendWebsiteInfo(phone: string, conversationId: string): Promise<void> {
    const text = 
`🌐 *DS Dukan Official Website:*
https://www.dsdukan.com/#

🎁 ওয়েবসাইটে সরাসরি অর্ডার করলে পাচ্ছেন *২% ইনস্ট্যান্ট ডিসকাউন্ট* এবং সাথে সাথে ডেলিভারি!`;

    const buttons = [
      { id: 'btn_game_list', title: '🎮 গেম টপ-আপ নিন' }
    ];

    await whatsappService.sendInteractiveButtons(phone, text, buttons, 'DS Dukan Website');
  },

  /**
   * Handle Customer Gratitude, Appreciation, Pleasantries or Acknowledgements
   */
  async handleGratitude(phone: string, conversationId: string, customerName?: string): Promise<void> {
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
      { id: 'btn_game_list', title: '🎮 নতুন অর্ডার' },
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
  },

  /**
   * Reassure customer about delivery time / processing queue
   */
  async handleStatusInquiry(phone: string, conversationId: string): Promise<void> {
    const text = 
`⚡ *আপনার অর্ডারটি প্রসেসিং কিউতে রয়েছে!*

আমাদের টপ-আপ টিম দ্রুততম সময়ে (সাধারণত ৫–১৫ মিনিটের মধ্যে) টপ-আপ সম্পন্ন করে আপনার অ্যাকাউন্টে পাঠিয়ে দেবে। 🚀

ডেলিভারি সম্পন্ন হওয়ামাত্র আপনি হোয়াটসঅ্যাপে নিশ্চিতকরণ মেসেজ পাবেন।`;

    const buttons = [
      { id: 'btn_track_order', title: '📦 অর্ডার ট্র্যাক' },
      { id: 'btn_game_list', title: '🎮 নতুন অর্ডার' }
    ];

    await whatsappService.sendInteractiveButtons(phone, text, buttons, 'DS Dukan Support');

    await db.addMessage({
      conversationId,
      sender: 'BOT',
      content: text,
      metadata: { type: 'STATUS_INQUIRY_REPLY' }
    });
  }
};

