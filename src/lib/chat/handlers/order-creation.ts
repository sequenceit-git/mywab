import { db } from '../../db';
import { whatsappService } from '../../whatsapp/service';
import { zinipayClient } from '../../zinipay/client';
import { env } from '../../config/env';
import { extractCleanUid, getAccountFieldInfo, isRefusalOrCancellation, isGreetingOrMenu } from '../input-parser';
import { ConversationSessionState } from '@/types';
import { sendWelcomeAndGameList } from './catalog-navigation';
import { handleCancellation } from './info-handlers';

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
      cus_name: `Player ${cleanUid}`,
      cus_email: `customer_${phone.replace(/\D/g, '') || cleanUid}@sequenceit.software`,
      metadata: {
        order_id: pendingOrder.order_id,
        customer_phone: phone,
        player_uid: cleanUid,
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
      playerUid: cleanUid
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
