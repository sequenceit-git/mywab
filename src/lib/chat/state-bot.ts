import { db } from '../db';
import { whatsappService } from '../whatsapp/service';
import { telegramBot } from '../telegram/bot';
import { telegramQueue } from '../telegram/queue';
import { kokosClient } from '../kokos/client';
import { pinexClient } from '../pinex/client';
import { zinipayClient } from '../zinipay/client';
import { orderPaymentService } from '../services/order-payment';
import { env } from '../config/env';
import { GAME_CATEGORIES, GameCategory, GamePackage, PAYMENT_ACCOUNTS, findGameCategory, findPackage, formatWhatsAppRow, formatWhatsAppButton } from './game-catalog';
import { extractCleanUid, extractPaymentProof, getAccountFieldInfo, getGameDeliveryConfig, isGratitudeOrPleasantry, isStatusInquiry, isGreetingOrMenu, parseSlashCommand, isRefusalOrCancellation, isPriceInquiry } from './input-parser';
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

    // 0. Slash Commands (e.g. /menu, /start, /track, /cancel, /website, /help, /movie, /pubg, /ff, /efootball)
    const slash = parseSlashCommand(rawText);
    if (slash) {
      switch (slash.command) {
        case 'menu':
        case 'cancel':
          await this.sendWelcomeAndGameList(phone, conversationId, customerName);
          return;

        case 'track':
          await this.handleTrackOrder(phone, conversationId, '', slash.args || '');
          return;

        case 'website':
          await this.sendWebsiteInfo(phone, conversationId);
          return;

        case 'help':
          await this.sendHelpInfo(phone, conversationId);
          return;

        case 'movie': {
          const movieGame = findGameCategory('game_movie');
          if (movieGame) {
            await this.handleGameSelection(phone, conversationId, movieGame);
            return;
          }
          break;
        }

        case 'pubg': {
          const pubgGame = findGameCategory('game_pubg_uid');
          if (pubgGame) {
            await this.handleGameSelection(phone, conversationId, pubgGame);
            return;
          }
          break;
        }

        case 'ff': {
          const ffGame = findGameCategory('game_ff');
          if (ffGame) {
            await this.handleGameSelection(phone, conversationId, ffGame);
            return;
          }
          break;
        }

        case 'efootball': {
          const efbGame = findGameCategory('game_efb_android');
          if (efbGame) {
            await this.handleGameSelection(phone, conversationId, efbGame);
            return;
          }
          break;
        }

        default:
          await this.sendHelpInfo(phone, conversationId);
          return;
      }
    }

    // 0.0 ZiniPay Check Payment Status trigger (Button or text inquiry)
    const isCheckPayTrigger = triggerId.startsWith('check_pay:') ||
      (session.step === 'AWAITING_PAYMENT' && ['check', 'check payment', 'check pay', 'paid', 'পেমেন্ট করেছি', 'পেমেন্ট শেষ', 'টাকা দিয়েছি', 'টাকা দিছি', 'পেমেন্ট চেক'].includes(normalizedText));

    if (isCheckPayTrigger) {
      await this.handleCheckPayment(phone, conversationId, triggerId, rawText, session);
      return;
    }

    // 0. If in AWAITING_PAYMENT and user entered valid payment proof (TrxID / last 4 digits / phone), process payment immediately!
    if (session.step === 'AWAITING_PAYMENT' && rawText && !triggerId.startsWith('game_') && !triggerId.startsWith('pkg_')) {
      const isMenuBtn = ['btn_menu', 'btn_restart', 'btn_change_game', 'btn_main_menu', 'btn_game_list', 'btn_cancel'].includes(triggerId);
      if (!isMenuBtn) {
        const item = session.draftOrder.items?.[0];
        const amount = session.draftOrder.totalAmount || item?.unitPrice || 0;
        const selectedMethod = session.draftOrder.paymentMethod || 'BKASH';
        const accountNumber = PAYMENT_ACCOUNTS[selectedMethod.toLowerCase() as keyof typeof PAYMENT_ACCOUNTS] || PAYMENT_ACCOUNTS.bkash;

        const paymentProof = extractPaymentProof(rawText, {
          expectedAmount: amount,
          recipientAccount: accountNumber,
          playerUid: session.draftOrder.playerUid
        });

        if (paymentProof.isValid && paymentProof.rawProof) {
          await this.handleTrxIdInput(phone, conversationId, userId, rawText, session);
          return;
        }
      }
    }

    // 1. Refusal, Cancellation or Change of mind ("No kinbo na", "pore nibo", "lagbe na", "thak", "দরকার নেই", etc.)
    if (isRefusalOrCancellation(rawText) || isRefusalOrCancellation(triggerId)) {
      await this.handleCancellation(phone, conversationId, customerName);
      return;
    }

    // 2. Quick-restart / Menu button clicked or Greeting / Menu reset request
    const isMenuButton = [
      'btn_menu', 'btn_restart', 'btn_change_game', 'btn_main_menu', 
      'btn_game_list', 'btn_cancel'
    ].includes(triggerId);

    if (isMenuButton || isGreetingOrMenu(rawText) || isGreetingOrMenu(triggerId)) {
      await this.sendWelcomeAndGameList(phone, conversationId, customerName);
      return;
    }

    // 3. PUBG QR Code actions (Done or Need New QR)
    if (triggerId.startsWith('qr_done:') || ['qr done', 'scan done', 'scan sesh', 'স্ক্যান করেছি', 'স্ক্যান সম্পন্ন', 'qr scan done'].includes(normalizedText)) {
      await this.handleQrAction(phone, conversationId, triggerId, rawText, 'DONE');
      return;
    }

    if (triggerId.startsWith('qr_refresh:') || ['new qr', 'notun qr', 'qr expired', 'need qr', 'নতুন qr', 'নতুন qr কোড দিন', 'qr expire', 'expire'].includes(normalizedText)) {
      await this.handleQrAction(phone, conversationId, triggerId, rawText, 'REFRESH');
      return;
    }

    // 4. Track Order button or text
    if (triggerId === 'btn_track_order' || triggerId.startsWith('track:') || /^(?:track|অর্ডার\s*ট্র্যাক|ট্র্যাক|track\s*order)/i.test(normalizedText)) {
      await this.handleTrackOrder(phone, conversationId, triggerId, rawText);
      return;
    }

    // 5. Website button or text
    if (triggerId === 'btn_website' || /^(?:website|ওয়েবসাইট|ওয়েবসাইট\s*তথ্য)/i.test(normalizedText)) {
      await this.sendWebsiteInfo(phone, conversationId);
      return;
    }

    // 5. Price / Packages inquiries ("dam koto", "price koto", "koto taka")
    if (isPriceInquiry(rawText)) {
      const currentGame = session.draftOrder.selectedGame ? findGameCategory(session.draftOrder.selectedGame) : undefined;
      if (currentGame) {
        await this.sendPackageList(phone, conversationId, currentGame);
      } else {
        await this.sendWelcomeAndGameList(phone, conversationId, customerName);
      }
      return;
    }

    // 6. Gratitude, Acknowledgements & Pleasantries (e.g. "Thank you", "Nice", "Ok", "Done", "Peyechi", etc.)
    if (isGratitudeOrPleasantry(rawText)) {
      await this.handleGratitude(phone, conversationId, customerName);
      return;
    }

    // 7. Status inquiries ("order status", "status", "delivery status")
    if (isStatusInquiry(rawText)) {
      await this.handleStatusInquiry(phone, conversationId);
      return;
    }

    // 6. Payment method buttons / selection
    if (
      triggerId.startsWith('pay_') ||
      (session.step === 'AWAITING_PAYMENT' && ['bkash', 'nagad', 'rocket', 'বিকাশ', 'নগদ', 'রকেট'].includes(normalizedText))
    ) {
      await this.handlePaymentMethodSelection(phone, conversationId, triggerId || rawText, session);
      return;
    }

    // 7. If awaiting payment and user entered payment proof or text (without clicking a game button)
    if (session.step === 'AWAITING_PAYMENT' && !triggerId.startsWith('game_') && !triggerId.startsWith('pkg_')) {
      const isExplicitGameSwitch = ['movie', 'netflix', 'pubg', 'freefire', 'free fire', 'efootball', 'pes'].includes(normalizedText);
      if (!isExplicitGameSwitch) {
        await this.handleTrxIdInput(phone, conversationId, userId, rawText, session);
        return;
      }
    }

    // 8. If collecting UID and user entered a valid UID / Email
    if (session.step === 'COLLECTING_UID' && !triggerId.startsWith('game_') && !triggerId.startsWith('pkg_')) {
      const cleanUid = extractCleanUid(rawText, session.draftOrder.selectedGame || session.draftOrder.selectedGameLabel);
      if (cleanUid) {
        await this.handleUidInput(phone, conversationId, rawText, session, userId);
        return;
      }
    }

    // 9. Check if trigger or text is selecting one of the game categories (supported in any step!)
    const baseGame = findGameCategory(triggerId) || findGameCategory(rawText);
    const matchedGame = baseGame ? (db.getCachedCategory(baseGame.id) || baseGame) : undefined;
    if (matchedGame) {
      // Check if user also directly specified a package in the same message (e.g. "Netflix 1 month", "PUBG 60 UC")
      const directPackage = findPackage(matchedGame, triggerId) || findPackage(matchedGame, rawText);
      if (directPackage) {
        await this.handlePackageSelection(phone, conversationId, matchedGame, directPackage);
        return;
      }
      await this.handleGameSelection(phone, conversationId, matchedGame);
      return;
    }

    // 10. Check if trigger or text is selecting a package for the currently selected game
    if (session.step === 'SELECTING_PACKAGE' || triggerId.startsWith('pkg_')) {
      const selectedGameId = session.draftOrder.selectedGame;
      const baseCurrentGame = selectedGameId ? findGameCategory(selectedGameId) : undefined;
      const currentGame = baseCurrentGame ? (db.getCachedCategory(baseCurrentGame.id) || baseCurrentGame) : undefined;
      if (currentGame) {
        const matchedPackage = findPackage(currentGame, triggerId) || findPackage(currentGame, rawText);
        if (matchedPackage) {
          await this.handlePackageSelection(phone, conversationId, currentGame, matchedPackage);
          return;
        }
      }
    }

    // 11. Step-specific text input routing
    switch (session.step) {
      case 'COLLECTING_UID':
        await this.handleUidInput(phone, conversationId, rawText, session, userId);
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
        const fallbackBaseGame = session.draftOrder.selectedGame ? findGameCategory(session.draftOrder.selectedGame) : undefined;
        const game = fallbackBaseGame ? (db.getCachedCategory(fallbackBaseGame.id) || fallbackBaseGame) : undefined;
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
নিচের মেনু থেকে আপনার কাঙ্ক্ষিত গেম বা সার্ভিসটি সিলেক্ট করুন। ডেলিভারি মাত্র ৫–১৫ মিনিটে! ⚡

💡 *কমান্ড টিপস:* যেকোনো সময় মেনু দেখতে */menu*, অর্ডার ট্র্যাক করতে */track* বা সহায়তার জন্য */help* লিখুন।`;

    const categories = db.getCachedCategories();

    const sections = [
      {
        title: 'DS Dukan Game Catalog',
        rows: categories.map(cat => ({
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
    const categories = db.getCachedCategories();

    const sections = [
      {
        title: 'DS Dukan Games',
        rows: categories.map(cat => ({
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
    const liveGame = db.getCachedCategory(game.id) || game;

    db.setSessionState(conversationId, {
      step: 'SELECTING_PACKAGE',
      draftOrder: {
        items: [],
        selectedGame: liveGame.code,
        selectedGameLabel: liveGame.fullName
      }
    });

    await this.sendPackageList(phone, conversationId, liveGame);
  },

  /**
   * Send the price list and package selection buttons / list for a specific game
   */
  async sendPackageList(phone: string, conversationId: string, game: GameCategory): Promise<void> {
    const liveGame = db.getCachedCategory(game.id) || game;
    const activePackages = liveGame.packages.filter(p => p.isActive !== false);

    // Build price list text
    let priceListText = `🎮 *${liveGame.fullName} — PRICE LIST*\n\n`;
    activePackages.forEach((pkg) => {
      priceListText += `• *${pkg.name}* : ৳${pkg.price} Tk\n`;
    });
    priceListText += `\n⚡ ডেলিভারি সময়: ৫–১৫ মিনিট\n🎁 ওয়েবসাইট থেকে কিনলে ২% ইনস্ট্যান্ট ডিসকাউন্ট!`;

    // If game has 3 or fewer packages, send interactive quick-reply buttons
    if (activePackages.length <= 3) {
      const buttons = activePackages.map(p => formatWhatsAppButton(p));

      await whatsappService.sendInteractiveButtons(
        phone,
        `${priceListText}\n\nআপনার প্যাকেজটি বেছে নিন:`,
        buttons,
        `${liveGame.emoji} ${liveGame.title}`,
        'DS Dukan'
      );
    } else {
      // If game has >3 packages, send an Interactive List Message (supports up to 10 rows)
      const sections = [
        {
          title: `${liveGame.title} Packages`.slice(0, 24),
          rows: activePackages.slice(0, 10).map(pkg => formatWhatsAppRow(pkg))
        }
      ];

      await whatsappService.sendInteractiveList(
        phone,
        `${priceListText}\n\nনিচের বাটন থেকে আপনার কাঙ্ক্ষিত প্যাকেজটি সিলেক্ট করুন:`,
        'প্যাকেজ বেছে নিন 💎',
        sections,
        `${liveGame.emoji} ${liveGame.title}`,
        'DS Dukan'
      );
    }

    await db.addMessage({
      conversationId,
      sender: 'BOT',
      content: priceListText,
      metadata: { type: 'price_list', game: liveGame.code }
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
    session: ConversationSessionState,
    userId?: string
  ): Promise<void> {
    if (isRefusalOrCancellation(rawText)) {
      await this.handleCancellation(phone, conversationId);
      return;
    }

    if (isGreetingOrMenu(rawText)) {
      await this.sendWelcomeAndGameList(phone, conversationId);
      return;
    }

    const cleanUid = extractCleanUid(rawText, session.draftOrder.selectedGame || session.draftOrder.selectedGameLabel);

    if (!cleanUid || cleanUid.length < 3) {
      const gameLabel = session.draftOrder.selectedGameLabel || 'গেম';
      const accountInfo = getAccountFieldInfo('', gameLabel);
      const buttons = [
        { id: 'btn_main_menu', title: '🔙 মেইন মেনু' }
      ];
      await whatsappService.sendInteractiveButtons(
        phone,
        `⚠️ আপনার প্রদানকৃত *${accountInfo.labelBn}* তথ্যটি সঠিক মনে হচ্ছে না।\n\nঅনুগ্রহ করে আপনার সঠিক ${accountInfo.labelBn} লিখে পাঠান (অথবা অন্য সার্ভিস দেখতে নিচে মেইন মেনু সিলেক্ট করুন):`,
        buttons,
        'সঠিক তথ্য দিন'
      );
      return;
    }

    const item = session.draftOrder.items?.[0];
    const amount = session.draftOrder.totalAmount || item?.unitPrice || 0;
    const gameLabel = session.draftOrder.selectedGameLabel || 'গেম টপ-আপ';
    const pkgName = item?.skuOrName || 'প্যাকেজ';
    const accountInfo = getAccountFieldInfo(cleanUid, gameLabel);
    const effectiveUserId = userId || (await db.getOrCreateUser(phone)).id;

    // Check if ZiniPay Automatic Payment is enabled
    const isZiniPayEnabled = db.isZiniPayAutoPaymentEnabled() && zinipayClient.isConfigured();

    if (isZiniPayEnabled && amount > 0) {
      try {
        // 1. Create order in Database with PENDING_PAYMENT
        const pendingOrder = await db.createOrder({
          userId: effectiveUserId,
          deliveryPhone: phone,
          playerUid: cleanUid,
          paymentMethod: 'ZINIPAY',
          status: 'PENDING_PAYMENT',
          items: [
            {
              product_name: `${gameLabel} (${pkgName})`,
              unit_price: amount,
              quantity: 1
            }
          ],
          customerNotes: `State Bot Order | Game: ${gameLabel} | ${accountInfo.labelEn}: ${cleanUid} | Mode: Auto ZiniPay`
        });

        // 2. Create Hosted Invoice via ZiniPay API
        const invoiceRes = await zinipayClient.createInvoice({
          amount,
          cus_name: cleanUid,
          metadata: {
            order_id: pendingOrder.order_id,
            customer_phone: phone,
            player_uid: cleanUid,
            service: gameLabel,
            package: pkgName
          },
          redirect_url: `${env.app.url}/payment/success?order_id=${pendingOrder.order_id}`,
          cancel_url: `${env.app.url}/payment/cancel?order_id=${pendingOrder.order_id}`
        });

        if (invoiceRes.status && invoiceRes.payment_url) {
          await db.attachInvoiceToOrder(
            pendingOrder.order_id,
            invoiceRes.invoice_id || '',
            invoiceRes.payment_url
          );

          db.setSessionState(conversationId, {
            step: 'AWAITING_PAYMENT',
            draftOrder: {
              ...session.draftOrder,
              playerUid: cleanUid,
              pendingOrderId: pendingOrder.order_id,
              invoiceId: invoiceRes.invoice_id,
              paymentUrl: invoiceRes.payment_url
            }
          });

          await whatsappService.sendPaymentInvoicePrompt({
            toPhone: phone,
            orderIdCode: pendingOrder.order_id,
            paymentUrl: invoiceRes.payment_url,
            amount,
            gameLabel,
            packageName: pkgName,
            playerUid: cleanUid,
            accountLabelBn: accountInfo.labelBn
          });

          await db.addMessage({
            conversationId,
            sender: 'BOT',
            content: `⚡ পেমেন্ট লিংক তৈরি হয়েছে: ${invoiceRes.payment_url}`,
            metadata: {
              step: 'AWAITING_PAYMENT',
              orderId: pendingOrder.order_id,
              invoiceId: invoiceRes.invoice_id,
              paymentUrl: invoiceRes.payment_url,
              amount
            }
          });

          return;
        } else {
          console.warn('[ZiniPay Invoice Error]: Falling back to manual payment:', invoiceRes.error);
        }
      } catch (err) {
        console.error('[ZiniPay Creation Exception]:', err);
      }
    }

    // Fallback: Manual Send Money Payment Flow
    db.setSessionState(conversationId, {
      step: 'AWAITING_PAYMENT',
      draftOrder: {
        ...session.draftOrder,
        playerUid: cleanUid
      }
    });

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
   * Real-time Check Payment status via ZiniPay API
   */
  async handleCheckPayment(
    phone: string,
    conversationId: string,
    triggerId: string,
    rawText: string,
    session: ConversationSessionState
  ): Promise<void> {
    const orderId = triggerId.startsWith('check_pay:')
      ? triggerId.split(':')[1]?.trim()
      : session.draftOrder?.pendingOrderId || session.lastOrderId;

    let invoiceId = session.draftOrder?.invoiceId;

    let order = orderId ? await db.getOrderByCode(orderId) : null;
    if (!order && invoiceId) {
      order = await db.getOrderByInvoiceId(invoiceId);
    }

    if (order && !invoiceId && order.invoice_id) {
      invoiceId = order.invoice_id;
    }

    if (!invoiceId && order?.payment_url) {
      invoiceId = zinipayClient.extractInvoiceId(order.payment_url);
    }

    if (!invoiceId) {
      await whatsappService.sendMessage(
        phone,
        `⚠️ পেমেন্ট ভেরিফাই করার জন্য কোনো সক্রিয় ইনভয়েস পাওয়া যায়নি।\n\nআপনি যদি ম্যানুয়ালি টাকা পাঠিয়ে থাকেন, তবে অনুগ্রহ করে আপনার TrxID মেসেজে লিখে পাঠান:`
      );
      return;
    }

    // Call ZiniPay verify
    const verifyRes = await zinipayClient.verifyInvoice(invoiceId);

    if (verifyRes.status === 'COMPLETED') {
      const trxId = verifyRes.transaction_id || `ZINI-${Date.now()}`;
      const paymentMethod = verifyRes.payment_method || 'bKash';
      const amount = Number(verifyRes.amount) || order?.total_amount || 0;

      // Clear draft
      if (order) {
        db.clearSessionDraft(conversationId, order.order_id);
      }
      db.setSessionState(conversationId, { step: 'ORDER_PLACED' });

      await orderPaymentService.handlePaymentVerified({
        orderIdCode: order?.order_id,
        invoiceId,
        trxId,
        paymentMethod,
        amount,
        customerName: verifyRes.cus_name
      });
      return;
    }

    if (verifyRes.status === 'PENDING') {
      const payUrl = order?.payment_url || session.draftOrder?.paymentUrl;
      const pendingMsg = 
`⏳ *পেমেন্ট এখনও পেন্ডিং রয়েছে!*

আপনার পেমেন্টটি এখনও আমাদের গেটওয়েতে জমা পড়েনি। 
আপনি যদি এখনও টাকা না পাঠিয়ে থাকেন, তবে নিচের লিংকে গিয়ে পেমেন্ট সম্পন্ন করুন:

🔗 *পেমেন্ট লিংক:*
${payUrl || 'https://secure.zinipay.com'}

*(পেমেন্ট সম্পন্ন করার ১–২ মিনিট পর আবার নিচের বাটনে চাপ দিন)*`;

      const buttons = [
        { id: `check_pay:${order?.order_id || ''}`, title: '🔄 আবার চেক করুন' },
        { id: 'btn_main_menu', title: '🔙 মেইন মেনু' }
      ];

      await whatsappService.sendInteractiveButtons(phone, pendingMsg, buttons, 'পেমেন্ট পেন্ডিং');
      return;
    }

    // FAILED or other
    const failedMsg = 
`❌ *পেমেন্ট সম্পন্ন হয়নি বা বাতিল হয়েছে।*

আপনার আগের পেমেন্ট সেশনটি সফল হয়নি। অনুগ্রহ করে নতুন করে চেষ্টা করুন অথবা অন্য মাধ্যমে টাকা পাঠান।`;

    const buttons = [
      { id: 'btn_main_menu', title: '🎮 নতুন অর্ডার' }
    ];

    await whatsappService.sendInteractiveButtons(phone, failedMsg, buttons, 'পেমেন্ট ব্যর্থ');
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
  ) {
    const item = session.draftOrder.items?.[0];
    const amount = session.draftOrder.totalAmount || item?.unitPrice || 0;
    const selectedMethod = session.draftOrder.paymentMethod || 'BKASH';
    const methodName = selectedMethod === 'NAGAD' ? 'Nagad (নগদ)' : selectedMethod === 'ROCKET' ? 'Rocket (রকেট)' : 'bKash (বিকাশ)';
    const accountNumber = PAYMENT_ACCOUNTS[selectedMethod.toLowerCase() as keyof typeof PAYMENT_ACCOUNTS] || PAYMENT_ACCOUNTS.bkash;

    const extracted = extractPaymentProof(rawText, {
      expectedAmount: amount,
      recipientAccount: accountNumber,
      playerUid: session.draftOrder.playerUid
    });

    // If customer did not provide a valid TrxID or Last 4 digits (e.g. sent "Baksh e send koreci", "taka disi", "done")
    if (!extracted.isValid || !extracted.rawProof) {
      if (isRefusalOrCancellation(rawText)) {
        await this.handleCancellation(phone, conversationId);
        return;
      }

      if (isGreetingOrMenu(rawText)) {
        await this.sendWelcomeAndGameList(phone, conversationId);
        return;
      }
      const promptText = 
`⚠️ *সঠিক TrxID অথবা লাস্ট ৪ ডিজিট পাওয়া যায়নি!*

টাকা পাঠিয়ে থাকলে অনুগ্রহ করে আপনার *TrxID* (যেমন: \`BK9827361\`) অথবা সেন্ডার নম্বরের *লাস্ট ৪ ডিজিট* (যেমন: \`4591\`) লিখে মেসেজ পাঠান।

💳 *${methodName} নম্বর:* \`${accountNumber}\`
💰 *প্রদেয় টাকার পরিমাণ:* ৳${amount} Tk

*(বাতিল করতে চাইলে নিচে 'বাতিল করুন' বাটনে চাপ দিন)*`;

      const buttons = [
        { id: 'btn_main_menu', title: '❌ বাতিল করুন' }
      ];

      await whatsappService.sendInteractiveButtons(phone, promptText, buttons, 'সঠিক TrxID দিন');
      return;
    }

    const paymentMethod = (extracted.paymentMethod !== 'BKASH/NAGAD/ROCKET' ? extracted.paymentMethod : session.draftOrder.paymentMethod) || 'BKASH';
    const cleanTrx = extracted.rawProof;
    const unitPrice = item?.unitPrice || amount;
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

      const selectedGame = session.draftOrder.selectedGame || '';
      const isPubgUid = selectedGame === 'game_pubg_uid' || (session.draftOrder.selectedGameLabel || '').toLowerCase().includes('pubg');
      const isKokosEnabled = db.isKokosAutoFulfillEnabled() && kokosClient.isConfigured();

      // Check if this order is eligible for Kokos API Auto-Fulfillment
      if (isPubgUid && isKokosEnabled) {
        // Extract numeric denomination (e.g. 60, 325, 660, 1800, 3850, 8100)
        const denomMatch = (item?.skuOrName || productName).match(/\d+/);
        const denomination = denomMatch ? parseInt(denomMatch[0], 10) : null;

        if (denomination && playerUid && playerUid !== 'N/A') {
          console.log(`[Kokos Auto-Fulfill] Attempting redemption for Player ${playerUid}, Denomination ${denomination} UC...`);

          const kokosResult = await kokosClient.redeemCode({
            playerId: playerUid,
            denomination,
            gameId: 'pubg_mobile',
            requireReceipt: true
          });

          if (kokosResult.success && kokosResult.receipt) {
            const receipt = kokosResult.receipt;
            console.log(`[Kokos Auto-Fulfill Success] Receipt #${receipt.id} delivered in ${receipt.took}ms to "${receipt.name}"`);

            // Mark order delivered in database with receipt details
            await db.updateOrderStatus(
              order.order_id,
              'DELIVERED',
              {
                isAdminOverride: true,
                notes: `Kokos Auto-Fulfilled | Receipt #${receipt.id} | Player: ${receipt.name || playerUid} | Took: ${receipt.took}ms`
              }
            );

            // Automated delivery message to customer on WhatsApp
            const deliveryMsg = `🎉 *PUBG Mobile UC টপ-আপ সফলভাবে সম্পন্ন হয়েছে!*

🎮 *সার্ভিস:* PUBG Mobile (UID Top-Up)
👤 *Player Name:* \`${receipt.name || 'In-Game Player'}\`
🆔 *Player ID:* \`${playerUid}\`
💎 *পরিমাণ:* *${denomination} UC*
🧾 *Kokos Receipt ID:* \`#${receipt.id}\`
⏱️ *ডেলিভারি সময়:* ${(receipt.took / 1000).toFixed(1)} সেকেন্ড
💰 *অর্ডার আইডি:* \`#${order.order_id}\`

আপনার অ্যাকাউন্টে UC যোগ হয়ে গেছে। ধন্যবাদ সাথে থাকার জন্য! ❤️`;

            const buttons = [
              { id: 'btn_main_menu', title: '🎮 নতুন অর্ডার করুন' },
              { id: `track:${order.order_id}`, title: '📦 অর্ডার বিস্তারিত' }
            ];

            await whatsappService.sendInteractiveButtons(phone, deliveryMsg, buttons, 'টপ-আপ ডেলিভারি সম্পন্ন');

            await db.addMessage({
              conversationId,
              sender: 'BOT',
              content: deliveryMsg,
              metadata: { orderId: order.order_id, kokosReceipt: receipt, step: 'DELIVERED' }
            });

            return;
          } else {
            console.warn('[Kokos Auto-Fulfill Error]:', kokosResult.error);
            // Log fallback in customer notes
            order.customer_notes = `${order.customer_notes} | ⚠️ Kokos Auto-Fulfill Failed: ${kokosResult.error?.errorCode || 'Error'}`;
            // Fallback to Telegram Worker Bot Queue so humans can fulfill in order
            telegramQueue.enqueueOrder(order).catch(err => {
              console.warn('[Telegram Worker Queue Enqueue Warning]:', err);
            });

            // Send standard order confirmation to customer
            await whatsappService.sendOrderConfirmation(order);

            await db.addMessage({
              conversationId,
              sender: 'BOT',
              content: `🎉 অর্ডার #${order.order_id} সফলভাবে তৈরি হয়েছে। আমাদের টিম দ্রুত প্রসেস করছে।`,
              metadata: { orderId: order.order_id, kokosError: kokosResult.error, step: 'ORDER_PLACED' }
            });

            return;
          }
        }
      }

      // Check if this order is eligible for Pinex API Auto-Fulfillment (Free Fire)
      const isFreeFire = selectedGame === 'game_ff' ||
        (session.draftOrder.selectedGameLabel || '').toLowerCase().includes('free fire') ||
        (session.draftOrder.selectedGameLabel || '').toLowerCase().includes('ff') ||
        (productName || '').toLowerCase().includes('diamond');
      const isPinexEnabled = db.isPinexAutoFulfillEnabled() && pinexClient.isConfigured();

      if (isFreeFire && isPinexEnabled) {
        if (playerUid && playerUid !== 'N/A') {
          console.log(`[Pinex Auto-Fulfill] Processing Free Fire Order #${order.order_id} for Player ${playerUid}...`);

          const pinexResult = await pinexClient.autoRedeemFreeFire({
            playerId: playerUid,
            packageNameOrAmount: item?.skuOrName || productName,
            orderId: order.order_id
          });

          if (pinexResult.success) {
            console.log(`[Pinex Auto-Fulfill Success] Free Fire Order #${order.order_id} delivered immediately.`);

            // Mark order delivered in database with Pinex details
            await db.updateOrderStatus(
              order.order_id,
              'DELIVERED',
              {
                isAdminOverride: true,
                notes: `Pinex Auto-Fulfilled | TRX: ${pinexResult.trxIdOrContent || 'COMPLETED'} | Player: ${pinexResult.nickname || playerUid}`
              }
            );

            // Automated delivery message to customer on WhatsApp
            const deliveryMsg = `🎉 *Free Fire ডায়মন্ড টপ-আপ সফলভাবে সম্পন্ন হয়েছে!*

🔥 *সার্ভিস:* Free Fire (Direct UID Top-Up)
👤 *Player Name:* \`${pinexResult.nickname || 'In-Game Player'}\`
🆔 *Player UID:* \`${playerUid}\`
💎 *প্যাকেজ:* *${item?.skuOrName || productName}*
🧾 *Pinex TRX ID:* \`${pinexResult.trxIdOrContent || 'COMPLETED'}\`
💰 *অর্ডার আইডি:* \`#${order.order_id}\`

আপনার অ্যাকাউন্টে ডায়মন্ড যোগ হয়ে গেছে। ধন্যবাদ সাথে থাকার জন্য! ❤️`;

            const buttons = [
              { id: 'btn_main_menu', title: '🎮 নতুন অর্ডার করুন' },
              { id: `track:${order.order_id}`, title: '📦 অর্ডার বিস্তারিত' }
            ];

            await whatsappService.sendInteractiveButtons(phone, deliveryMsg, buttons, 'টপ-আপ ডেলিভারি সম্পন্ন');

            await db.addMessage({
              conversationId,
              sender: 'BOT',
              content: deliveryMsg,
              metadata: { orderId: order.order_id, pinexResult, step: 'DELIVERED' }
            });

            // NO Telegram bot needed for Free Fire auto-fulfillment as requested!
            return;
          } else {
            console.log(`[Pinex Auto-Fulfill Response] Order #${order.order_id} status: ${pinexResult.status}`);

            // Send confirmation that order is accepted and being processed via Pinex
            const processingMsg = `🎉 *অর্ডার #${order.order_id} গ্রহণ করা হয়েছে!*

🔥 *সার্ভিস:* Free Fire (Direct UID Top-Up)
🆔 *Player UID:* \`${playerUid}\`
💎 *প্যাকেজ:* *${item?.skuOrName || productName}*
⚡ *স্ট্যাটাস:* স্বয়ংক্রিয়ভাবে টপ-আপ প্রসেস হচ্ছে...

কিছুক্ষণের মধ্যে আপনার ফ্রি ফায়ার আইডিতে ডায়মন্ড যুক্ত হয়ে যাবে।`;

            const buttons = [
              { id: `track:${order.order_id}`, title: '📦 অর্ডার ট্র্যাক' },
              { id: 'btn_main_menu', title: '🔙 মেইন মেনু' }
            ];

            await whatsappService.sendInteractiveButtons(phone, processingMsg, buttons, 'অর্ডার প্রসেস হচ্ছে');

            await db.addMessage({
              conversationId,
              sender: 'BOT',
              content: processingMsg,
              metadata: { orderId: order.order_id, pinexResult, step: 'ORDER_PLACED' }
            });

            // NO Telegram bot needed for Free Fire auto-fulfillment as requested!
            return;
          }
        }
      }

      // Default Flow: Enqueue to Telegram Worker Group (for other games like PUBG Login/QR, Efootball, Subscriptions, etc.)
      telegramQueue.enqueueOrder(order).catch(err => {
        console.warn('[Telegram Worker Queue Enqueue Warning]:', err);
      });

      // Send WhatsApp structured order confirmation
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
   * Handle PUBG QR customer action (QR Scanned vs Need New QR)
   */
  async handleQrAction(
    phone: string,
    conversationId: string,
    triggerId: string,
    rawText: string,
    actionType: 'DONE' | 'REFRESH'
  ): Promise<void> {
    let orderIdCode = '';
    if (triggerId.startsWith('qr_done:')) {
      orderIdCode = triggerId.replace('qr_done:', '').trim();
    } else if (triggerId.startsWith('qr_refresh:')) {
      orderIdCode = triggerId.replace('qr_refresh:', '').trim();
    }

    // If order ID not in trigger, lookup recent active order for this phone
    if (!orderIdCode) {
      const activeOrders = await db.getOrders({ limit: 10 });
      const cleanPhone = phone.replace(/\D/g, '');
      const recentOrder = activeOrders.find(o => 
        o.delivery_phone.replace(/\D/g, '').includes(cleanPhone) &&
        ['PROCESSING', 'CLAIMED', 'PENDING_CLAIM'].includes(o.status)
      );
      if (recentOrder) {
        orderIdCode = recentOrder.order_id;
      }
    }

    if (actionType === 'DONE') {
      const replyMsg = 
`✅ *ধন্যবাদ! আপনার QR কোড স্ক্যান সম্পন্ন হয়েছে।*

আমাদের এজেন্ট এখন আপনার অ্যাকাউন্টে লগইন করে UC টপ-আপ সম্পন্ন করছেন। কিছুক্ষণের মধ্যেই আপনি নিশ্চিতকরণ মেসেজ পাবেন। ⏳✨`;

      const buttons = [
        { id: `track:${orderIdCode || ''}`, title: '📦 অর্ডার স্ট্যাটাস' },
        { id: 'btn_main_menu', title: '🎮 মেইন মেনু' }
      ];

      await whatsappService.sendInteractiveButtons(phone, replyMsg, buttons, 'QR স্ক্যান নিশ্চিত');
      await db.addMessage({
        conversationId,
        sender: 'BOT',
        content: replyMsg,
        metadata: { step: 'QR_SCANNED', orderId: orderIdCode }
      });

      if (orderIdCode) {
        await telegramBot.notifyWorkerQrAction(orderIdCode, 'SCANNED');
      }
    } else {
      // REFRESH
      const replyMsg = 
`🔄 *নতুন QR কোডের জন্য রিকোয়েস্ট পাঠানো হয়েছে।*

আমাদের এজেন্ট কিছুক্ষণের মধ্যেই একটি নতুন Login QR কোড পাঠাচ্ছেন। দয়া করে একটু অপেক্ষা করুন... ⏳`;

      const buttons = [
        { id: `track:${orderIdCode || ''}`, title: '📦 অর্ডার স্ট্যাটাস' },
        { id: 'btn_main_menu', title: '❌ বাতিল করুন' }
      ];

      await whatsappService.sendInteractiveButtons(phone, replyMsg, buttons, 'নতুন QR রিকোয়েস্ট');
      await db.addMessage({
        conversationId,
        sender: 'BOT',
        content: replyMsg,
        metadata: { step: 'QR_REFRESH_REQUESTED', orderId: orderIdCode }
      });

      if (orderIdCode) {
        await telegramBot.notifyWorkerQrAction(orderIdCode, 'REFRESH_REQUESTED');
      }
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
      { id: 'btn_main_menu', title: '🎮 সব সার্ভিস ও গেম' },
      { id: 'btn_website', title: '🌐 ওয়েবসাইট (২% ছাড়)' }
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
      { id: 'btn_main_menu', title: '🎮 সব সার্ভিস ও গেম' }
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
      { id: 'btn_main_menu', title: '🎮 সব সার্ভিস ও গেম' }
    ];

    await whatsappService.sendInteractiveButtons(phone, text, buttons, 'DS Dukan Support');

    await db.addMessage({
      conversationId,
      sender: 'BOT',
      content: text,
      metadata: { type: 'STATUS_INQUIRY_REPLY' }
    });
  },

  /**
   * Help & Slash Command guide
   */
  async sendHelpInfo(phone: string, conversationId: string): Promise<void> {
    const text = 
`ℹ️ *DS Dukan — কমান্ড ও সহায়তা নির্দেশিকা (Commands & Guide)*

আমাদের সাথে যেকোনো সময় সহজে ইন্টারঅ্যাক্ট করতে নিচের কমান্ডগুলো ব্যবহার করতে পারেন:

📌 *বেসিক কমান্ডসমূহ:*
• */menu* বা */start* : সব গেম ও সার্ভিসের তালিকা
• */track [OrderID]* : লাইভ অর্ডার স্ট্যাটাস চেক
• */cancel* : চলমান অর্ডার বাতিল ও মেনুতে ফিরে যাওয়া
• */website* : অফিশিয়াল ওয়েবসাইট (২% ইনস্ট্যান্ট ছাড়)
• */help* : সহায়তা ও কমান্ড লিস্ট

🎮 *সার্ভিস শর্টকাট:*
• */pubg* : PUBG Mobile UC প্রাইস ও টপ-আপ
• */ff* : Free Fire Diamond প্রাইস ও টপ-আপ
• */movie* : Netflix, Crunchyroll, Spotify সাবস্ক্রিপশন
• */efootball* : eFootball Coins প্রাইস ও টপ-আপ

📞 কোনো সমস্যা বা সহায়তার জন্য আমাদের ইনবক্সে সরাসরি লিখুন।`;

    const buttons = [
      { id: 'btn_main_menu', title: '🎮 সব সার্ভিস ও গেম' },
      { id: 'btn_track_order', title: '📦 অর্ডার ট্র্যাক' },
      { id: 'btn_website', title: '🌐 ওয়েবসাইট (২% ছাড়)' }
    ];

    await whatsappService.sendInteractiveButtons(phone, text, buttons, 'DS Dukan Help');

    await db.addMessage({
      conversationId,
      sender: 'BOT',
      content: text,
      metadata: { type: 'HELP_INFO' }
    });
  },

  /**
   * Handle Refusal, Cancellation or Change of mind gracefully
   */
  async handleCancellation(phone: string, conversationId: string, customerName?: string): Promise<void> {
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
};

