import { db } from '../db';
import { whatsappService } from '../whatsapp/service';
import { telegramBot } from '../telegram/bot';
import { telegramQueue } from '../telegram/queue';
import { kokosClient } from '../kokos/client';
import { pinexClient } from '../pinex/client';
import { Order } from '@/types';
import { buildStreamingCredsNote, resolveStreamingPresetForOrder } from '../streaming-accounts';

export interface PaymentSuccessParams {
  orderIdCode?: string;
  invoiceId?: string;
  trxId: string;
  paymentMethod: string;
  amount: number;
  customerName?: string;
}

export interface PaymentProcessResult {
  success: boolean;
  alreadyProcessed?: boolean;
  order?: Order;
  message?: string;
  deliveryType?: 'KOKOS_AUTO' | 'PINEX_AUTO' | 'STREAMING_AUTO' | 'TELEGRAM_WORKER';
}

export const orderPaymentService = {
  /**
   * Process a verified payment from ZiniPay (webhook, redirect verification, or in-bot check)
   */
  async handlePaymentVerified(params: PaymentSuccessParams): Promise<PaymentProcessResult> {
    const { orderIdCode, invoiceId, trxId, paymentMethod, amount } = params;

    console.log(`[OrderPaymentService] Processing payment verification: Order=${orderIdCode || 'N/A'}, Invoice=${invoiceId || 'N/A'}, TrxID=${trxId}, Amount=${amount}, Method=${paymentMethod}`);

    // 1. Locate Order
    let order: Order | null = null;
    if (orderIdCode) {
      order = await db.getOrderByCode(orderIdCode);
    }
    if (!order && invoiceId) {
      order = await db.getOrderByInvoiceId(invoiceId);
    }

    if (!order) {
      console.error(`[OrderPaymentService Error] Order not found for orderId=${orderIdCode}, invoiceId=${invoiceId}`);
      return {
        success: false,
        message: 'Order not found in database.'
      };
    }

    // 2. Idempotency Check: Don't re-fulfill if already delivered or processing
    const isAlreadyPaid = order.status === 'DELIVERED' || 
      order.status === 'PROCESSING' || 
      order.status === 'CLAIMED' || 
      order.status === 'OUT_FOR_DELIVERY';

    if (isAlreadyPaid && order.trx_id) {
      console.log(`[OrderPaymentService Idempotency] Order #${order.order_id} is already processed (${order.status}). Skipping duplicate fulfillment.`);
      return {
        success: true,
        alreadyProcessed: true,
        order,
        message: `Order #${order.order_id} is already fulfilled/processing.`
      };
    }

    // 3. Atomically update payment and order in Database
    const updateRes = await db.updateOrderPaymentSuccess(order.order_id, {
      trxId: trxId || 'ZINIPAY_VERIFIED',
      paymentMethod: paymentMethod || 'bKash',
      invoiceId: invoiceId || order.invoice_id,
      amount: amount || order.total_amount
    });

    if (updateRes.order) {
      order = updateRes.order;
    }

    const phone = order.delivery_phone;
    const playerUid = order.player_uid || order.delivery_address?.name || 'N/A';
    const firstItem = order.items?.[0];
    const productName = firstItem?.product_name || 'Game Package';
    const itemSku = firstItem?.product_name || '';

    // Send immediate Payment Receipt to customer on WhatsApp
    const paymentReceiptMsg = 
`✅ *পেমেন্ট সফলভাবে গৃহীত হয়েছে! / Payment Received!*

📦 *অর্ডার আইডি:* \`#${order.order_id}\`
💰 *পরিশোধিত টাকা:* *৳${amount || order.total_amount} Tk*
💳 *পেমেন্ট মাধ্যম:* *${paymentMethod.toUpperCase()} (স্বয়ংক্রিয় গেটওয়ে)*
🧾 *TrxID:* \`${trxId}\`

⚡ আপনার অর্ডারটি এখন ডেলিভারির জন্য প্রসেস হচ্ছে...`;

    await whatsappService.sendMessage(phone, paymentReceiptMsg);

    // 4. Automated Fulfillment Engine

    // A. PUBG Mobile UID -> Kokos Auto-Redemption
    const isPubgUid = (order.customer_notes || '').toLowerCase().includes('pubg') ||
      (productName || '').toLowerCase().includes('pubg') ||
      (productName || '').toLowerCase().includes('uc');

    const isKokosEnabled = db.isKokosAutoFulfillEnabled() && kokosClient.isConfigured();

    if (isPubgUid && isKokosEnabled) {
      const denomMatch = (firstItem?.product_name || productName).match(/\d+/);
      const denomination = denomMatch ? parseInt(denomMatch[0], 10) : null;

      if (denomination && playerUid && playerUid !== 'N/A') {
        console.log(`[Kokos Auto-Fulfill] Redeeming ${denomination} UC for Player ${playerUid}...`);

        const kokosResult = await kokosClient.redeemCode({
          playerId: playerUid,
          denomination,
          gameId: 'pubg_mobile',
          requireReceipt: true
        });

        if (kokosResult.success && kokosResult.receipt) {
          const receipt = kokosResult.receipt;
          console.log(`[Kokos Auto-Fulfill Success] Receipt #${receipt.id} delivered in ${receipt.took}ms`);

          await db.updateOrderStatus(order.order_id, 'DELIVERED', {
            isAdminOverride: true,
            notes: `Kokos Auto-Fulfilled | Receipt #${receipt.id} | Player: ${receipt.name || playerUid} | Took: ${receipt.took}ms | ZiniPay Trx: ${trxId}`
          });

          const deliveryMsg = 
`🎉 *PUBG Mobile UC টপ-আপ সফলভাবে সম্পন্ন হয়েছে!*

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

          return {
            success: true,
            order,
            deliveryType: 'KOKOS_AUTO',
            message: 'PUBG UC auto-delivered via Kokos.'
          };
        } else {
          console.warn('[Kokos Auto-Fulfill Warning]: Kokos failed, falling back to Telegram staff queue:', kokosResult.error);
        }
      }
    }

    // B. Free Fire UID -> Pinex Auto-Redemption
    const isFreeFire = (order.customer_notes || '').toLowerCase().includes('free fire') ||
      (order.customer_notes || '').toLowerCase().includes('ff') ||
      (productName || '').toLowerCase().includes('free fire') ||
      (productName || '').toLowerCase().includes('diamond');

    const isPinexEnabled = db.isPinexAutoFulfillEnabled() && pinexClient.isConfigured();

    if (isFreeFire && isPinexEnabled) {
      if (playerUid && playerUid !== 'N/A') {
        console.log(`[Pinex Auto-Fulfill] Redeeming Free Fire package for Player ${playerUid}...`);

        const pinexResult = await pinexClient.autoRedeemFreeFire({
          playerId: playerUid,
          packageNameOrAmount: firstItem?.product_name || productName,
          orderId: order.order_id
        });

        if (pinexResult.success) {
          console.log(`[Pinex Auto-Fulfill Success] Free Fire Order #${order.order_id} delivered.`);

          await db.updateOrderStatus(order.order_id, 'DELIVERED', {
            isAdminOverride: true,
            notes: `Pinex Auto-Fulfilled | TRX: ${pinexResult.trxIdOrContent || 'COMPLETED'} | Player: ${pinexResult.nickname || playerUid} | ZiniPay: ${trxId}`
          });

          const deliveryMsg = 
`🎉 *Free Fire ডায়মন্ড টপ-আপ সফলভাবে সম্পন্ন হয়েছে!*

🔥 *সার্ভিস:* Free Fire (Direct UID Top-Up)
👤 *Player Name:* \`${pinexResult.nickname || 'In-Game Player'}\`
🆔 *Player UID:* \`${playerUid}\`
💎 *প্যাকেজ:* *${firstItem?.product_name || productName}*
🧾 *Pinex TRX ID:* \`${pinexResult.trxIdOrContent || 'COMPLETED'}\`
💰 *অর্ডার আইডি:* \`#${order.order_id}\`

আপনার অ্যাকাউন্টে ডায়মন্ড যোগ হয়ে গেছে। ধন্যবাদ সাথে থাকার জন্য! ❤️`;

          const buttons = [
            { id: 'btn_main_menu', title: '🎮 নতুন অর্ডার করুন' },
            { id: `track:${order.order_id}`, title: '📦 অর্ডার বিস্তারিত' }
          ];

          await whatsappService.sendInteractiveButtons(phone, deliveryMsg, buttons, 'টপ-আপ ডেলিভারি সম্পন্ন');

          return {
            success: true,
            order,
            deliveryType: 'PINEX_AUTO',
            message: 'Free Fire Diamonds auto-delivered via Pinex.'
          };
        } else {
          console.log(`[Pinex Auto-Fulfill Status]: ${pinexResult.status}`);
          await db.updateOrderStatus(order.order_id, 'PROCESSING', {
            isAdminOverride: true,
            notes: `Pinex Processing | ZiniPay: ${trxId}`
          });

          const processingMsg = 
`🎉 *অর্ডার #${order.order_id} গ্রহণ করা হয়েছে!*

🔥 *সার্ভিস:* Free Fire (Direct UID Top-Up)
🆔 *Player UID:* \`${playerUid}\`
💎 *প্যাকেজ:* *${firstItem?.product_name || productName}*
⚡ *স্ট্যাটাস:* স্বয়ংক্রিয়ভাবে টপ-আপ প্রসেস হচ্ছে...

কিছুক্ষণের মধ্যে আপনার ফ্রি ফায়ার আইডিতে ডায়মন্ড যুক্ত হয়ে যাবে।`;

          const buttons = [
            { id: `track:${order.order_id}`, title: '📦 অর্ডার ট্র্যাক' },
            { id: 'btn_main_menu', title: '🔙 মেইন মেনু' }
          ];

          await whatsappService.sendInteractiveButtons(phone, processingMsg, buttons, 'অর্ডার প্রসেস হচ্ছে');

          return {
            success: true,
            order,
            deliveryType: 'PINEX_AUTO',
            message: 'Free Fire order queued on Pinex.'
          };
        }
      }
    }

    // C. Netflix / Crunchyroll — preset account auto-delivery (set on Pricing → package)
    const streamingPreset = await resolveStreamingPresetForOrder(order);

    if (streamingPreset) {
      const { service, creds: presetCreds } = streamingPreset;
      const credsNote = buildStreamingCredsNote(service, presetCreds);
      const paymentNote = `Payment Verified via ZiniPay (${paymentMethod} | TXN: ${trxId})`;
      const combinedNotes = `${paymentNote} | ${credsNote}`;

      await db.updateOrderStatus(order.order_id, 'PENDING_CLAIM', {
        isAdminOverride: true,
        notes: combinedNotes
      });

      if (service === 'netflix') {
        await whatsappService.sendNetflixAccountInfo(
          phone,
          order.order_id,
          presetCreds.email,
          presetCreds.password,
          presetCreds.pin
        );
      } else {
        await whatsappService.sendCrunchyrollAccountInfo(
          phone,
          order.order_id,
          presetCreds.email,
          presetCreds.password
        );
      }

      const refreshedOrder = (await db.getOrderByCode(order.order_id)) || order;

      try {
        const queueCount = await db.getUndispatchedQueueCount();
        const dispatchRes = await telegramBot.dispatchNewOrder(refreshedOrder, queueCount);
        console.log(
          `[OrderPaymentService] Streaming auto-account dispatch for #${refreshedOrder.order_id}:`,
          dispatchRes
        );
      } catch (tgErr) {
        console.error('[OrderPaymentService Streaming Telegram Dispatch Error]:', tgErr);
      }

      return {
        success: true,
        order: refreshedOrder,
        deliveryType: 'STREAMING_AUTO',
        message: `${service} preset account delivered on WhatsApp; Telegram notified for OTP support.`
      };
    }

    // D. Default: Manual Service (PUBG QR/Login, eFootball, Movie Subscriptions, or Auto-Fulfill Fallback)
    // Update order status to PENDING_CLAIM and dispatch to Telegram Worker Group
    await db.updateOrderStatus(order.order_id, 'PENDING_CLAIM', {
      isAdminOverride: true,
      notes: `Payment Verified via ZiniPay (${paymentMethod} | TXN: ${trxId})`
    });

    const refreshedOrder = (await db.getOrderByCode(order.order_id)) || order;

    // Dispatch directly to Telegram Worker Group immediately so staff can claim and fulfill!
    try {
      const queueCount = await db.getUndispatchedQueueCount();
      const dispatchRes = await telegramBot.dispatchNewOrder(refreshedOrder, queueCount);
      console.log(`[OrderPaymentService] Telegram Direct Dispatch Result for #${refreshedOrder.order_id}:`, dispatchRes);
    } catch (tgErr) {
      console.error('[OrderPaymentService Telegram Dispatch Error]:', tgErr);
    }

    // Send structured order confirmation to customer
    await whatsappService.sendOrderConfirmation(refreshedOrder);

    return {
      success: true,
      order: refreshedOrder,
      deliveryType: 'TELEGRAM_WORKER',
      message: 'Order dispatched to Telegram staff queue with verified payment.'
    };
  }
};
