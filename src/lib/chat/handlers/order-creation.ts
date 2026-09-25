import { db } from '../../db';
import { whatsappService } from '../../whatsapp/service';
import { zinipayClient } from '../../zinipay/client';
import { kokosClient } from '../../kokos/client';
import { env } from '../../config/env';
import { extractCleanUid, getAccountFieldInfo, isRefusalOrCancellation, isGreetingOrMenu } from '../input-parser';
import { ConversationSessionState } from '@/types';
import { sendWelcomeAndGameList } from './catalog-navigation';
import { handleCancellation } from './info-handlers';

/** Games whose UIDs should be validated via Kokos /character before proceeding to payment */
const KOKOS_VALIDATED_GAMES = new Set(['pubg_uid']);

/**
 * Step 3 -> Step 4: Validate UID input and display Payment summary + 1-Tap Method Selection Buttons
 */
export async function handleUidInput(
  phone: string,
  conversationId: string,
  rawText: string,
  session: ConversationSessionState,
  userId?: string
): Promise<void> {
  if (isRefusalOrCancellation(rawText)) {
    await handleCancellation(phone, conversationId);
    return;
  }

  if (isGreetingOrMenu(rawText)) {
    await sendWelcomeAndGameList(phone, conversationId);
    return;
  }

  const cleanUid = extractCleanUid(rawText, session.draftOrder.selectedGame || session.draftOrder.selectedGameLabel);

  if (!cleanUid || cleanUid.length < 2) {
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

  // --- Kokos UID Validation for PUBG UID / PUBG KR orders ---
  const selectedGame = session.draftOrder.selectedGame || '';
  const shouldValidateViaKokos = KOKOS_VALIDATED_GAMES.has(selectedGame) && kokosClient.isConfigured();

  let validatedPlayerName: string | undefined;

  if (shouldValidateViaKokos) {
    const kokosGameId = selectedGame === 'pubg_kr' ? 'pubg_mobile_kr' : 'pubg_mobile';

    await whatsappService.sendMessage(phone, `⏳ *Player UID যাচাই করা হচ্ছে...* অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন।`);

    const lookupResult = await kokosClient.getCharacter(cleanUid, kokosGameId);

    if (!lookupResult.success || !lookupResult.name) {
      console.log(`[UID Validation] Kokos lookup failed for UID ${cleanUid} (game=${kokosGameId}): ${lookupResult.error || 'no name returned'}`);

      await whatsappService.sendInteractiveButtons(
        phone,
        `❌ *Player UID সঠিক নয়!*\n\nআপনার প্রদানকৃত UID \`${cleanUid}\` দিয়ে কোনো PUBG Mobile প্লেয়ার খুঁজে পাওয়া যায়নি।\n\n⚠️ অনুগ্রহ করে আপনার সঠিক *Player UID* আবার লিখে পাঠান:`,
        [{ id: 'btn_main_menu', title: '🔙 মেইন মেনু' }],
        'সঠিক UID দিন'
      );
      return;
    }

    validatedPlayerName = lookupResult.name;
    console.log(`[UID Validation] Success: UID=${cleanUid}, Name="${validatedPlayerName}"`);

    // Store validated player name in session for the payment summary
    db.setSessionState(conversationId, {
      step: session.step,
      draftOrder: {
        ...session.draftOrder,
        playerUid: cleanUid,
        playerName: validatedPlayerName
      }
    });
  }

  // Check if this game requires account password after UID/Email (e.g. eFootball Android / iOS)
  const isEfootball = (session.draftOrder.selectedGame || '').includes('efb') ||
                      (session.draftOrder.selectedGameLabel || '').toLowerCase().includes('efootball') ||
                      (session.draftOrder.selectedGame || '').includes('efootball');

  if (isEfootball) {
    db.setSessionState(conversationId, {
      step: 'COLLECTING_PASSWORD',
      draftOrder: {
        ...session.draftOrder,
        playerUid: cleanUid
      }
    });

    const buttons = [
      { id: 'btn_main_menu', title: '🔙 মেইন মেনু' }
    ];

    await whatsappService.sendInteractiveButtons(
      phone,
      `🔐 আপনার *Konami ID* (\`${cleanUid}\`) এর জন্য *অ্যাকাউন্টের পাসওয়ার্ড (Password)* টি লিখে পাঠান:\n\n_(কয়েন টপ-আপের জন্য পাসওয়ার্ড প্রয়োজন, টপ-আপ শেষে প্রয়োজনে পরিবর্তন করে নিতে পারেন)_`,
      buttons,
      'পাসওয়ার্ড দিন'
    );

    await db.addMessage({
      conversationId,
      sender: 'BOT',
      content: `🔐 আপনার Konami ID (${cleanUid}) এর জন্য পাসওয়ার্ড (Password) লিখে পাঠান:`,
      metadata: { step: 'COLLECTING_PASSWORD', playerUid: cleanUid }
    });

    return;
  }

  await proceedToCreateOrderAndPayment(phone, conversationId, cleanUid, '', session, userId, validatedPlayerName);
}

/**
 * Step 3b -> Step 4: Validate account Password input (for eFootball) and proceed to payment
 */
export async function handlePasswordInput(
  phone: string,
  conversationId: string,
  rawText: string,
  session: ConversationSessionState,
  userId?: string
): Promise<void> {
  if (isRefusalOrCancellation(rawText)) {
    await handleCancellation(phone, conversationId);
    return;
  }

  if (isGreetingOrMenu(rawText)) {
    await sendWelcomeAndGameList(phone, conversationId);
    return;
  }

  let password = rawText.trim();
  // Strip conversational prefixes if provided
  password = password
    .replace(/^(?:password|pass|পাসওয়ার্ড|পাসওয়ার্ড\s*হলো|পাসওয়ার্ড\s*হচ্ছে|আমার\s*পাসওয়ার্ড|amar\s*pass(?:word)?)\s*[:=\-#—–]?\s*/i, '')
    .trim();

  if (!password || password.length < 2) {
    const buttons = [
      { id: 'btn_main_menu', title: '🔙 মেইন মেনু' }
    ];
    await whatsappService.sendInteractiveButtons(
      phone,
      `⚠️ অনুগ্রহ করে আপনার Konami অ্যাকাউন্টের সঠিক *পাসওয়ার্ড (Password)* লিখে পাঠান:`,
      buttons,
      'সঠিক পাসওয়ার্ড দিন'
    );
    return;
  }

  const cleanUid = session.draftOrder.playerUid || 'N/A';
  await proceedToCreateOrderAndPayment(phone, conversationId, cleanUid, password, session, userId);
}

/**
 * Helper to create order in database and generate ZiniPay hosted invoice
 */
export async function proceedToCreateOrderAndPayment(
  phone: string,
  conversationId: string,
  cleanUid: string,
  password: string,
  session: ConversationSessionState,
  userId?: string,
  validatedPlayerName?: string
): Promise<void> {
  const item = session.draftOrder.items?.[0];
  const amount = session.draftOrder.totalAmount || item?.unitPrice || 0;
  const gameLabel = session.draftOrder.selectedGameLabel || 'গেম টপ-আপ';
  const pkgName = item?.skuOrName || 'প্যাকেজ';
  const accountInfo = getAccountFieldInfo(cleanUid, gameLabel);
  const effectiveUserId = userId || (await db.getOrCreateUser(phone)).id;

  const passwordNote = password ? ` | Password: ${password}` : '';
  const playerNameNote = validatedPlayerName ? ` | PlayerName: ${validatedPlayerName}` : '';

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
          product_id: item?.packageId,
          product_name: `${gameLabel} (${pkgName})`,
          unit_price: amount,
          quantity: 1
        }
      ],
      customerNotes: `State Bot Order | Game: ${gameLabel} | ${accountInfo.labelEn}: ${cleanUid}${playerNameNote}${passwordNote} | Mode: Auto ZiniPay`
    });

    // 2. Create Hosted Invoice via ZiniPay API
    const invoiceRes = await zinipayClient.createInvoice({
      amount,
      cus_name: validatedPlayerName ? `${validatedPlayerName} (${cleanUid})` : `Player ${cleanUid}`,
      cus_email: `customer_${phone.replace(/\D/g, '') || 'guest'}@sequenceit.software`,
      metadata: {
        order_id: pendingOrder.order_id,
        customer_phone: phone,
        player_uid: cleanUid,
        password: password || undefined,
        service: gameLabel,
        package: pkgName
      },
      redirect_url: `https://wa.me/${(env.whatsapp.botPhone || '15551419791').replace(/\D/g, '')}`,
      cancel_url: `https://wa.me/${(env.whatsapp.botPhone || '15551419791').replace(/\D/g, '')}`
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
          accountPassword: password || undefined,
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
        accountLabelBn: accountInfo.labelBn,
        playerName: validatedPlayerName
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
      console.error('[ZiniPay Invoice Error]:', invoiceRes.error);
    }
  } catch (err) {
    console.error('[ZiniPay Creation Exception]:', err);
  }

  // In case of any unexpected gateway communication error, provide instant retry
  db.setSessionState(conversationId, {
    step: 'AWAITING_PAYMENT',
    draftOrder: {
      ...session.draftOrder,
      playerUid: cleanUid,
      accountPassword: password || undefined
    }
  });

  const retryButtons = [
    { id: `retry_pay:${cleanUid}`, title: '🔄 আবার চেষ্টা করুন' },
    { id: 'btn_main_menu', title: '🔙 মেইন মেনু' }
  ];

  await whatsappService.sendInteractiveButtons(
    phone,
    `⚠️ *পেমেন্ট গেটওয়েতে সংযোগ করতে সমস্যা হয়েছে!*\n\n• গেম: *${gameLabel}*\n• প্যাকেজ: *${pkgName}*\n• মূল্য: *৳${amount} Tk*\n\nঅনুগ্রহ করে নিচের বাটনে ক্লিক করে আবার চেষ্টা করুন:`,
    retryButtons,
    'পেমেন্ট লিংক সমস্যা'
  );
}
