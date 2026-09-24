import { db } from '../db';
import { findGameCategory, findPackage } from './game-catalog';
import {
  extractCleanUid,
  isGratitudeOrPleasantry,
  isStatusInquiry,
  isGreetingOrMenu,
  parseSlashCommand,
  isRefusalOrCancellation,
  isPriceInquiry
} from './input-parser';

import {
  sendWelcomeAndGameList,
  sendGameList,
  handleGameSelection,
  sendPackageList,
  handlePackageSelection
} from './handlers/catalog-navigation';
import { handleUidInput, handlePasswordInput } from './handlers/order-creation';
import {
  handleCheckPayment,
  handlePaymentMethodSelection,
  handleTrxIdInput,
  handleQrAction,
  handleVerificationCodeInput
} from './handlers/payment-fulfillment';
import {
  handleTrackOrder,
  sendWebsiteInfo,
  handleGratitude,
  handleStatusInquiry,
  sendHelpInfo,
  handleCancellation
} from './handlers/info-handlers';

export * from './handlers/catalog-navigation';
export * from './handlers/order-creation';
export * from './handlers/payment-fulfillment';
export * from './handlers/info-handlers';

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
  // Navigation & Catalog
  sendWelcomeAndGameList,
  sendGameList,
  handleGameSelection,
  sendPackageList,
  handlePackageSelection,

  // Order Placement
  handleUidInput,

  // Payment & Fulfillment
  handleCheckPayment,
  handlePaymentMethodSelection,
  handleTrxIdInput,
  handleQrAction,
  handleVerificationCodeInput,

  // Info & Status
  handleTrackOrder,
  sendWebsiteInfo,
  handleGratitude,
  handleStatusInquiry,
  sendHelpInfo,
  handleCancellation,

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
          await sendWelcomeAndGameList(phone, conversationId, customerName);
          return;

        case 'track':
          await handleTrackOrder(phone, conversationId, '', slash.args || '');
          return;

        case 'website':
          await sendWebsiteInfo(phone, conversationId);
          return;

        case 'help':
          await sendHelpInfo(phone, conversationId);
          return;

        case 'movie': {
          const movieGame = findGameCategory('game_movie');
          if (movieGame) {
            await handleGameSelection(phone, conversationId, movieGame);
            return;
          }
          break;
        }

        case 'pubg': {
          const pubgGame = findGameCategory('game_pubg_uid');
          if (pubgGame) {
            await handleGameSelection(phone, conversationId, pubgGame);
            return;
          }
          break;
        }

        case 'ff': {
          const ffGame = findGameCategory('game_ff');
          if (ffGame) {
            await handleGameSelection(phone, conversationId, ffGame);
            return;
          }
          break;
        }

        case 'efootball': {
          const efbGame = findGameCategory('game_efb_android');
          if (efbGame) {
            await handleGameSelection(phone, conversationId, efbGame);
            return;
          }
          break;
        }

        default:
          await sendHelpInfo(phone, conversationId);
          return;
      }
    }

    // 0.0 ZiniPay Retry Pay trigger (Re-attempt invoice creation)
    if (triggerId.startsWith('retry_pay:')) {
      const targetUid = triggerId.split(':')[1]?.trim() || session.draftOrder?.playerUid;
      if (targetUid && targetUid !== 'new') {
        await handleUidInput(phone, conversationId, targetUid, session, userId);
        return;
      }
    }

    // 0.1 ZiniPay Check Payment Status trigger (Button or text inquiry)
    const isCheckPayTrigger = triggerId.startsWith('check_pay:') ||
      (session.step === 'AWAITING_PAYMENT' && ['check', 'check payment', 'check pay', 'paid', 'পেমেন্ট করেছি', 'পেমেন্ট শেষ', 'টাকা দিয়েছি', 'টাকা দিছি', 'পেমেন্ট চেক', 'done', 'yes', 'hoise', 'diyechi', 'send koresi'].includes(normalizedText));

    if (isCheckPayTrigger) {
      await handleCheckPayment(phone, conversationId, triggerId, rawText, session);
      return;
    }

    // 1. Refusal, Cancellation or Change of mind ("No kinbo na", "pore nibo", "lagbe na", "thak", "দরকার নেই", etc.)
    if (isRefusalOrCancellation(rawText) || isRefusalOrCancellation(triggerId)) {
      await handleCancellation(phone, conversationId, customerName);
      return;
    }

    // 2. Quick-restart / Menu button clicked or Greeting / Menu reset request
    const isMenuButton = [
      'btn_menu', 'btn_restart', 'btn_change_game', 'btn_main_menu', 
      'btn_game_list', 'btn_cancel'
    ].includes(triggerId);

    if (isMenuButton || isGreetingOrMenu(rawText) || isGreetingOrMenu(triggerId)) {
      await sendWelcomeAndGameList(phone, conversationId, customerName);
      return;
    }

    // 3. PUBG QR Code actions (Done or Need New QR)
    if (triggerId.startsWith('qr_done:') || ['qr done', 'scan done', 'scan sesh', 'স্ক্যান করেছি', 'স্ক্যান সম্পন্ন', 'qr scan done'].includes(normalizedText)) {
      await handleQrAction(phone, conversationId, triggerId, rawText, 'DONE');
      return;
    }

    if (triggerId.startsWith('qr_refresh:') || ['new qr', 'notun qr', 'qr expired', 'need qr', 'নতুন qr', 'নতুন qr কোড দিন', 'qr expire', 'expire'].includes(normalizedText)) {
      await handleQrAction(phone, conversationId, triggerId, rawText, 'REFRESH');
      return;
    }

    // 4. Track Order button or text
    if (triggerId === 'btn_track_order' || triggerId.startsWith('track:') || /^(?:track|অর্ডার\s*ট্র্যাক|ট্র্যাক|track\s*order)/i.test(normalizedText)) {
      await handleTrackOrder(phone, conversationId, triggerId, rawText);
      return;
    }

    // 5. Website button or text
    if (triggerId === 'btn_website' || /^(?:website|ওয়েবসাইট|ওয়েবসাইট\s*তথ্য)/i.test(normalizedText)) {
      await sendWebsiteInfo(phone, conversationId);
      return;
    }

    // 5. Price / Packages inquiries ("dam koto", "price koto", "koto taka")
    if (isPriceInquiry(rawText)) {
      const currentGame = session.draftOrder.selectedGame ? findGameCategory(session.draftOrder.selectedGame) : undefined;
      if (currentGame) {
        await sendPackageList(phone, conversationId, currentGame);
      } else {
        await sendWelcomeAndGameList(phone, conversationId, customerName);
      }
      return;
    }

    // 6. Gratitude, Acknowledgements & Pleasantries (e.g. "Thank you", "Nice", "Ok", "Done", "Peyechi", etc.)
    if (isGratitudeOrPleasantry(rawText)) {
      await handleGratitude(phone, conversationId, customerName);
      return;
    }

    // 7. Status inquiries ("order status", "status", "delivery status")
    if (isStatusInquiry(rawText)) {
      await handleStatusInquiry(phone, conversationId);
      return;
    }

    // 6. Payment method buttons / selection
    if (
      triggerId.startsWith('pay_') ||
      (session.step === 'AWAITING_PAYMENT' && ['bkash', 'nagad', 'rocket', 'বিকাশ', 'নগদ', 'রকেট'].includes(normalizedText))
    ) {
      await handlePaymentMethodSelection(phone, conversationId, triggerId || rawText, session);
      return;
    }

    // 7. If awaiting payment and user entered text (without clicking a game button), check payment automatically!
    if (session.step === 'AWAITING_PAYMENT' && !triggerId.startsWith('game_') && !triggerId.startsWith('pkg_')) {
      const isExplicitGameSwitch = ['movie', 'netflix', 'pubg', 'freefire', 'free fire', 'efootball', 'pes'].includes(normalizedText);
      if (!isExplicitGameSwitch) {
        await handleCheckPayment(phone, conversationId, triggerId, rawText, session);
        return;
      }
    }

    // 8. If collecting UID and user entered a valid UID / Email
    if (session.step === 'COLLECTING_UID' && !triggerId.startsWith('game_') && !triggerId.startsWith('pkg_')) {
      const cleanUid = extractCleanUid(rawText, session.draftOrder.selectedGame || session.draftOrder.selectedGameLabel);
      if (cleanUid) {
        await handleUidInput(phone, conversationId, rawText, session, userId);
        return;
      }
    }

    // 8b. If collecting account password (e.g. eFootball)
    if (session.step === 'COLLECTING_PASSWORD' && !triggerId.startsWith('game_') && !triggerId.startsWith('pkg_')) {
      await handlePasswordInput(phone, conversationId, rawText, session, userId);
      return;
    }

    // 8c. Email verification code capture (PUBG KR / eFootball "code method" only — worker requested this via Telegram)
    if (session.step === 'AWAITING_VERIFICATION_CODE' && !triggerId.startsWith('game_') && !triggerId.startsWith('pkg_')) {
      await handleVerificationCodeInput(phone, conversationId, rawText, session);
      return;
    }

    // 9. Check if trigger or text is selecting one of the game categories (supported in any step!)
    const baseGame = findGameCategory(triggerId) || findGameCategory(rawText);
    const matchedGame = baseGame ? (db.getCachedCategory(baseGame.id) || baseGame) : undefined;
    if (matchedGame) {
      // Check if user also directly specified a package in the same message (e.g. "Netflix 1 month", "PUBG 60 UC")
      const directPackage = findPackage(matchedGame, triggerId) || findPackage(matchedGame, rawText);
      if (directPackage) {
        await handlePackageSelection(phone, conversationId, matchedGame, directPackage);
        return;
      }
      await handleGameSelection(phone, conversationId, matchedGame);
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
          await handlePackageSelection(phone, conversationId, currentGame, matchedPackage);
          return;
        }
      }
    }

    // 11. Step-specific text input routing
    switch (session.step) {
      case 'COLLECTING_UID':
        await handleUidInput(phone, conversationId, rawText, session, userId);
        break;

      case 'COLLECTING_PASSWORD':
        await handlePasswordInput(phone, conversationId, rawText, session, userId);
        break;

      case 'AWAITING_PAYMENT':
        await handleCheckPayment(phone, conversationId, triggerId, rawText, session);
        break;

      case 'SELECTING_PACKAGE':
        const selectedGame = session.draftOrder.selectedGame ? findGameCategory(session.draftOrder.selectedGame) : undefined;
        if (selectedGame) {
          await sendPackageList(phone, conversationId, selectedGame);
        } else {
          await sendWelcomeAndGameList(phone, conversationId, customerName);
        }
        break;

      default:
        await sendWelcomeAndGameList(phone, conversationId, customerName);
        break;
    }
  }
};
