import { db } from '../db';
import { whatsappService, logBotMessageToConversation } from '../whatsapp/service';
import { telegramBot, telegramQueue } from '../telegram/bot';
import {
  kokosClient,
  decomposeKokosDenominations,
  type KokosActivationReceipt
} from '../kokos/client';
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

declare global {
  // eslint-disable-next-line no-var
  var __wapActivePaymentLocks: Set<string> | undefined;
}

// Cross-chunk concurrency mutex to block identical order fulfillments running simultaneously
const activePaymentLocks: Set<string> =
  globalThis.__wapActivePaymentLocks ||
  (globalThis.__wapActivePaymentLocks = new Set<string>());

export const FULFILLMENT_STALE_GRACE_MS = 90 * 1000;

export function isPaymentFulfillmentInFlight(orderIdCode?: string | null): boolean {
  const key = (orderIdCode || '').trim().toUpperCase();
  return Boolean(key && activePaymentLocks.has(key));
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

    // 2. In-process Mutex Lock: Block concurrent executions for the same order
    const lockKey = order.order_id.toUpperCase();
    if (activePaymentLocks.has(lockKey)) {
      console.log(`[OrderPaymentService Lock] Order #${order.order_id} fulfillment is already running. Skipping duplicate call.`);
      return {
        success: true,
        alreadyProcessed: true,
        order,
        message: `Order #${order.order_id} fulfillment is already in progress.`
      };
    }
    activePaymentLocks.add(lockKey);

    try {
      // 3. Idempotency Check: Don't re-fulfill if already delivered
      if (order.status === 'DELIVERED') {
        console.log(`[OrderPaymentService Idempotency] Order #${order.order_id} is already DELIVERED. Skipping duplicate.`);
        return {
          success: true,
          alreadyProcessed: true,
          order,
          message: `Order #${order.order_id} is already delivered.`
        };
      }

      // Guard by trx_id — if trx_id is already set, check whether it is already claimed/dispatched
      if (order.trx_id) {
        if (order.current_worker || order.telegram_message_id) {
          console.log(`[OrderPaymentService Idempotency] Order #${order.order_id} already has trx_id=${order.trx_id} and active fulfillment. Skipping duplicate.`);
          return {
            success: true,
            alreadyProcessed: true,
            order,
            message: `Order #${order.order_id} payment already recorded.`
          };
        }

        const lastTouchMs = new Date(order.updated_at || order.created_at).getTime();
        const withinGraceWindow =
          order.status === 'PROCESSING' &&
          Number.isFinite(lastTouchMs) &&
          Date.now() - lastTouchMs < FULFILLMENT_STALE_GRACE_MS;

        if (withinGraceWindow) {
          console.log(`[OrderPaymentService Idempotency] Order #${order.order_id} is within ${FULFILLMENT_STALE_GRACE_MS / 1000}s fulfillment grace window. Skipping duplicate.`);
          return {
            success: true,
            alreadyProcessed: true,
            order,
            message: `Order #${order.order_id} fulfillment is currently in progress.`
          };
        }

        // Self-Healing: Payment was recorded but order was left unassigned and undispatched to Telegram!
        console.warn(`[OrderPaymentService Healing] Order #${order.order_id} has trx_id=${order.trx_id} but is unassigned and undispatched! Dispatching to Telegram staff queue...`);
        if (order.status !== 'PENDING_CLAIM') {
          await db.updateOrderStatus(order.order_id, 'PENDING_CLAIM', { isAdminOverride: true });
          order = (await db.getOrderByCode(order.order_id)) || order;
        }
        await telegramQueue.enqueueOrder(order);
        return {
          success: true,
          order,
          deliveryType: 'TELEGRAM_WORKER',
          message: `Order #${order.order_id} recovered and dispatched to Telegram staff.`
        };
      }

      // 4. Atomically update payment and transition status to PROCESSING in Database
      const updateRes = await db.updateOrderPaymentSuccess(order.order_id, {
        trxId: trxId || 'ZINIPAY_VERIFIED',
        paymentMethod: paymentMethod || 'bKash',
        invoiceId: invoiceId || order.invoice_id,
        amount: amount || order.total_amount
      });

      // If DB atomic update says already processed, bail out early — no duplicate fulfillment
      if (updateRes.alreadyProcessed || !updateRes.success) {
        console.log(`[OrderPaymentService] DB atomic guard: Order #${order.order_id} already processed. Skipping.`);
        return {
          success: true,
          alreadyProcessed: true,
          order: updateRes.order || order,
          message: `Order #${order.order_id} payment already recorded (atomic guard).`
        };
      }

      if (updateRes.order) {
        order = updateRes.order;
      }

    const phone = order.delivery_phone;
    const playerUid = order.player_uid || order.delivery_address?.name || 'N/A';
    const firstItem = order.items?.[0];
    const productName = firstItem?.product_name || 'Game Package';

    // Free the customer session from AWAITING_PAYMENT immediately upon payment verification
    if (phone) {
      try {
        const conv = await db.getOrCreateConversation(phone);
        if (conv?.id) {
          db.clearSessionDraft(conv.id, order.order_id);
          db.setSessionState(conv.id, { step: 'IDLE' });
        }
      } catch (convErr) {
        console.warn('[OrderPaymentService Conversation Reset Warning]:', convErr);
      }
    }

    // Send immediate Payment Receipt to customer on WhatsApp
    const paymentReceiptMsg = 
`✅ *পেমেন্ট সফলভাবে গৃহীত হয়েছে! / Payment Received!*

📦 *অর্ডার আইডি:* \`#${order.order_id}\`
💰 *পরিশোধিত টাকা:* *৳${amount || order.total_amount} Tk*
💳 *পেমেন্ট মাধ্যম:* *${paymentMethod.toUpperCase()} (স্বয়ংক্রিয় গেটওয়ে)*
🧾 *TrxID:* \`${trxId}\`

⚡ আপনার অর্ডারটি এখন ডেলিভারির জন্য প্রসেস হচ্ছে...`;

    await whatsappService.sendMessage(phone, paymentReceiptMsg);
    await logBotMessageToConversation(phone, paymentReceiptMsg, {
      type: 'PAYMENT_RECEIPT',
      orderId: order.order_id,
      amount: amount || order.total_amount,
      trxId
    });

    // 4. Automated Fulfillment Engine

    // Refresh runtime settings so admin toggle changes reflect across all Next.js chunks
    await db.initSettings(true);

    // A. PUBG Mobile UID -> Kokos Auto-Redemption
    const rawOrderContext = `${order.customer_notes || ''} ${productName}`.toLowerCase();
    const isNonUidPubgOrOther =
      rawOrderContext.includes('qr') ||
      rawOrderContext.includes('login') ||
      rawOrderContext.includes('korean') ||
      rawOrderContext.includes('pubg_kr') ||
      rawOrderContext.includes('kr uc') ||
      rawOrderContext.includes('subscription') ||
      rawOrderContext.includes('prime') ||
      rawOrderContext.includes('growth') ||
      rawOrderContext.includes('free fire') ||
      rawOrderContext.includes('diamond');

    // Per-package override takes priority over the global Kokos toggle.
    // undefined override = inherit the global setting; true/false = force this package.
    let orderedPackage = firstItem?.product_id
      ? await db.getProductById(firstItem.product_id, true)
      : null;

    if (!orderedPackage && !isNonUidPubgOrOther) {
      const pubgUidPackages = await db.getProductsByCategory('game_pubg_uid', true, true);
      const parenPkgName = productName.match(/\(([^)]+)\)\s*$/)?.[1]?.trim().toLowerCase();
      if (parenPkgName) {
        orderedPackage =
          pubgUidPackages.find(p => p.name.trim().toLowerCase() === parenPkgName) || null;
      }
    }

    const isPubgUid = orderedPackage
      ? orderedPackage.categoryId === 'game_pubg_uid'
      : (rawOrderContext.includes('pubg') || rawOrderContext.includes('uc')) && !isNonUidPubgOrOther;

    const kokosOverride = orderedPackage?.kokosAutoFulfill;
    const globalKokosSetting = db.isKokosAutoFulfillEnabled();
    const isKokosEnabledForPackage =
      kokosOverride !== undefined ? kokosOverride : globalKokosSetting;
    const isKokosConfigured = kokosClient.isConfigured();
    const isKokosEnabled = isKokosEnabledForPackage && isKokosConfigured;

    console.log(`[Kokos Debug] Order #${order.order_id} | isPubgUid=${isPubgUid} | product_id=${firstItem?.product_id || 'MISSING'} | product_name=${productName} | playerUid=${playerUid} | packageFound=${!!orderedPackage} | kokosOverride=${kokosOverride} | globalSetting=${globalKokosSetting} | isKokosEnabledForPkg=${isKokosEnabledForPackage} | isConfigured=${isKokosConfigured} | FINAL isKokosEnabled=${isKokosEnabled}`);

    if (isPubgUid && isKokosEnabled) {
      const amountUcMatch = orderedPackage?.amount?.match(/(\d+)\s*uc/i)?.[1];
      const amountNumMatch = orderedPackage?.amount?.match(/\d+/)?.[0];
      const ucNumMatch = (firstItem?.product_name || productName).match(/(\d+)\s*uc/i)?.[1];
      const fallbackNumMatch = (firstItem?.product_name || productName).match(/\d+/)?.[0];
      const denominationStr = amountUcMatch || amountNumMatch || ucNumMatch || fallbackNumMatch;
      const denomination = denominationStr ? parseInt(denominationStr, 10) : null;
      const vouchers = denomination ? decomposeKokosDenominations(denomination) : null;

      console.log(`[Kokos Debug] denomination=${denomination} | vouchers=${JSON.stringify(vouchers)} | playerUid=${playerUid} | willAttemptRedeem=${!!(vouchers && vouchers.length > 0 && playerUid && playerUid !== 'N/A')}`);

      if (vouchers && vouchers.length > 0 && playerUid && playerUid !== 'N/A') {
        // Pre-redemption guard: Check fresh DB state to ensure Kokos was not already fulfilled
        const currentOrderFresh = await db.getOrderByCode(order.order_id);
        const alreadyKokosRedeemed =
          currentOrderFresh?.status === 'DELIVERED' ||
          (currentOrderFresh?.customer_notes || '').includes('Kokos Receipt') ||
          (currentOrderFresh?.customer_notes || '').includes('Kokos Auto-Fulfilled') ||
          (currentOrderFresh?.customer_notes || '').includes('Partial Kokos Auto-Fulfilled');

        if (alreadyKokosRedeemed) {
          console.log(`[Kokos Auto-Fulfill] Order #${order.order_id} already has a Kokos redemption. Skipping duplicate redeem.`);
          return {
            success: true,
            alreadyProcessed: true,
            order: currentOrderFresh || order,
            deliveryType: 'KOKOS_AUTO',
            message: 'PUBG UC already redeemed via Kokos.'
          };
        }

        // For composite UC packages (e.g. 120, 180, 385, 720, 1045), verify full voucher stock first
        let hasStockForComposite = true;
        if (vouchers.length > 1) {
          const neededCounts = new Map<number, number>();
          for (const v of vouchers) {
            neededCounts.set(v, (neededCounts.get(v) || 0) + 1);
          }

          const invRes = await kokosClient.getInventory();
          if (!invRes.success || !invRes.inventory) {
            hasStockForComposite = false;
            console.warn(`[Kokos Auto-Fulfill] Inventory pre-check failed for composite ${denomination} UC (${invRes.error || 'no inventory'}), falling back to Telegram staff queue.`);
          } else {
            for (const [denom, need] of neededCounts.entries()) {
              const available = Number(invRes.inventory[String(denom)] ?? 0);
              if (!Number.isFinite(available) || available < need) {
                hasStockForComposite = false;
                console.warn(`[Kokos Auto-Fulfill] Insufficient Kokos stock for composite ${denomination} UC (need ${need}x ${denom} UC, have ${available}). Falling back to Telegram staff queue.`);
                break;
              }
            }
          }
        }

        if (hasStockForComposite) {
          console.log(`[Kokos Auto-Fulfill] Redeeming ${denomination} UC (${vouchers.join(' + ')}) for Player ${playerUid}...`);

          const receipts: KokosActivationReceipt[] = [];
          let lastKokosError: unknown = null;

          for (const vDenom of vouchers) {
            const kokosResult = await kokosClient.redeemCode({
              playerId: playerUid,
              denomination: vDenom,
              gameId: 'pubg_mobile',
              requireReceipt: true
            });

            console.log(`[Kokos Debug] redeemCode(${vDenom}) result: success=${kokosResult.success} | receipt=${kokosResult.receipt?.id || 'NONE'} | error=${JSON.stringify(kokosResult.error || null)}`);

            if (kokosResult.success && kokosResult.receipt) {
              receipts.push(kokosResult.receipt);
            } else {
              lastKokosError = kokosResult.error || { message: 'Unknown Kokos error' };
              break;
            }
          }

          if (receipts.length === vouchers.length) {
            const totalTookMs = receipts.reduce((sum, r) => sum + (Number(r.took) || 0), 0);
            const receiptIds = receipts.map(r => `#${r.id}`).join(', ');
            const playerName = receipts[0]?.name || playerUid;
            console.log(`[Kokos Auto-Fulfill Success] Receipt(s) ${receiptIds} delivered in ${totalTookMs}ms`);

            const deliveredRes = await db.updateOrderStatus(order.order_id, 'DELIVERED', {
              isAdminOverride: true,
              notes: `Kokos Auto-Fulfilled | Receipt ${receiptIds} | Player: ${playerName} | Took: ${totalTookMs}ms | ZiniPay Trx: ${trxId}`
            });
            const deliveredOrder = deliveredRes.order || (await db.getOrderByCode(order.order_id)) || order;

            const deliveryMsg =
`🎉 *PUBG Mobile UC টপ-আপ সফলভাবে সম্পন্ন হয়েছে!*

🎮 *সার্ভিস:* PUBG Mobile (UID Top-Up)
👤 *Player Name:* \`${receipts[0]?.name || 'In-Game Player'}\`
🆔 *Player ID:* \`${playerUid}\`
💎 *পরিমাণ:* *${denomination} UC*
🧾 *Kokos Receipt ID:* \`${receiptIds}\`
⏱️ *ডেলিভারি সময়:* ${((totalTookMs || 0) / 1000).toFixed(1)} সেকেন্ড
💰 *অর্ডার আইডি:* \`#${order.order_id}\`

আপনার অ্যাকাউন্টে UC যোগ হয়ে গেছে। ধন্যবাদ সাথে থাকার জন্য! ❤️`;

            const buttons = [
              { id: 'btn_main_menu', title: '🎮 নতুন অর্ডার করুন' },
              { id: `track:${order.order_id}`, title: '📦 অর্ডার বিস্তারিত' }
            ];

            await whatsappService.sendInteractiveButtons(phone, deliveryMsg, buttons, 'টপ-আপ ডেলিভারি সম্পন্ন');
            await logBotMessageToConversation(phone, deliveryMsg, {
              type: 'KOKOS_DELIVERED',
              orderId: order.order_id,
              receiptId: receipts[0]?.id,
              receiptIds: receipts.map(r => r.id),
              playerUid,
              denomination
            });

            return {
              success: true,
              order: deliveredOrder,
              deliveryType: 'KOKOS_AUTO',
              message: 'PUBG UC auto-delivered via Kokos.'
            };
          } else if (receipts.length > 0) {
            const redeemedUc = vouchers.slice(0, receipts.length).reduce((sum, v) => sum + v, 0);
            const remainingUc = (denomination || 0) - redeemedUc;
            const partialReceiptIds = receipts.map(r => `#${r.id}`).join(', ');
            console.error(`[Kokos Auto-Fulfill Partial Failure] Redeemed ${redeemedUc}/${denomination} UC (${partialReceiptIds}), remaining ${remainingUc} UC failed (${JSON.stringify(lastKokosError)}). Escalating to Telegram staff.`);

            await db.updateOrderStatus(order.order_id, 'PENDING_CLAIM', {
              isAdminOverride: true,
              notes: `Partial Kokos Auto-Fulfilled: ${redeemedUc}/${denomination} UC (Receipts: ${partialReceiptIds}) | Remaining ${remainingUc} UC needs manual top-up`
            });
            order = (await db.getOrderByCode(order.order_id)) || order;
          } else {
            console.warn('[Kokos Auto-Fulfill Warning]: Kokos failed, falling back to Telegram staff queue:', JSON.stringify(lastKokosError));
          }
        }
      }
    } else if (isPubgUid && !isKokosEnabled) {
      console.log(`[Kokos Debug] SKIPPED auto-fulfill for PUBG order #${order.order_id}: Kokos not enabled (override=${kokosOverride}, global=${globalKokosSetting}, configured=${isKokosConfigured})`);
    } else if (!isPubgUid) {
      console.log(`[Kokos Debug] SKIPPED: Order #${order.order_id} not detected as PUBG UID (productName="${productName}", notes="${(order.customer_notes || '').substring(0, 80)}...")`);
    }

    // B. Free Fire UID -> Pinex Auto-Redemption
    const productId = firstItem?.product_id || '';
    const notesAndName = `${order.customer_notes || ''} ${productName}`.toLowerCase();
    const isFreeFire =
      productId.startsWith('pkg_ff_') ||
      productId.startsWith('game_ff') ||
      orderedPackage?.categoryId === 'game_ff' ||
      notesAndName.includes('free fire') ||
      notesAndName.includes('diamond');

    const isPinexEnabled = db.isPinexAutoFulfillEnabled() && pinexClient.isConfigured();

    if (isFreeFire && isPinexEnabled) {
      if (playerUid && playerUid !== 'N/A') {
        console.log(`[Pinex Auto-Fulfill] Redeeming Free Fire package ${productId || productName} for Player ${playerUid}...`);

        const pinexResult = await pinexClient.autoRedeemFreeFire({
          playerId: playerUid,
          packageNameOrAmount: firstItem?.product_name || productName,
          packageId: productId,
          orderId: order.order_id
        });

        if (pinexResult.success) {
          console.log(`[Pinex Auto-Fulfill Success] Free Fire Order #${order.order_id} delivered.`);

          const pinexDeliveredRes = await db.updateOrderStatus(order.order_id, 'DELIVERED', {
            isAdminOverride: true,
            notes: `Pinex Auto-Fulfilled | TRX: ${pinexResult.trxIdOrContent || 'COMPLETED'} | Player: ${pinexResult.nickname || playerUid} | ZiniPay: ${trxId}`
          });
          const pinexDeliveredOrder = pinexDeliveredRes.order || (await db.getOrderByCode(order.order_id)) || order;

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
          await logBotMessageToConversation(phone, deliveryMsg, {
            type: 'PINEX_DELIVERED',
            orderId: order.order_id,
            trxId: pinexResult.trxIdOrContent,
            playerUid
          });

          return {
            success: true,
            order: pinexDeliveredOrder,
            deliveryType: 'PINEX_AUTO',
            message: 'Free Fire Diamonds auto-delivered via Pinex.'
          };
        } else {
          console.warn('[Pinex Auto-Fulfill Warning]: Pinex auto-delivery failed/pending, falling back to Telegram staff queue:', pinexResult.status);
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

      if (service === 'netflix') {
        // Netflix: PENDING_CLAIM → worker claims for OTP/code support
        await db.updateOrderStatus(order.order_id, 'PENDING_CLAIM', {
          isAdminOverride: true,
          notes: combinedNotes
        });

        await whatsappService.sendNetflixAccountInfo(
          phone,
          order.order_id,
          presetCreds.email,
          presetCreds.password,
          presetCreds.pin,
          presetCreds.profileName,
          firstItem?.product_name
        );

        const refreshedOrder = (await db.getOrderByCode(order.order_id)) || order;

        try {
          const dispatchRes = await telegramQueue.enqueueOrder(refreshedOrder);
          console.log(`[OrderPaymentService] Netflix auto-account dispatch for #${refreshedOrder.order_id}:`, dispatchRes);
        } catch (tgErr) {
          console.error('[OrderPaymentService Netflix Telegram Dispatch Error]:', tgErr);
        }

        return {
          success: true,
          order: refreshedOrder,
          deliveryType: 'STREAMING_AUTO',
          message: 'Netflix preset account delivered on WhatsApp; Telegram notified for OTP support.'
        };
      } else {
        // Crunchyroll: fully auto-deliver → DELIVERED, no TG claim needed
        await whatsappService.sendCrunchyrollAccountInfo(
          phone,
          order.order_id,
          presetCreds.email,
          presetCreds.password,
          presetCreds.profileName
        );

        await db.updateOrderStatus(order.order_id, 'DELIVERED', {
          isAdminOverride: true,
          notes: `Auto-Delivered (Crunchyroll Preset) | ${combinedNotes}`
        });

        const refreshedOrder = (await db.getOrderByCode(order.order_id)) || order;

        // Send order completion message to customer
        await whatsappService.sendOrderDeliveredNotification(refreshedOrder);

        // Notify TG with a completed card (informational only, no claim buttons)
        try {
          const queueCount = await db.getUndispatchedQueueCount();
          const dispatchRes = await telegramBot.dispatchNewOrder(refreshedOrder, queueCount);
          console.log(`[OrderPaymentService] Crunchyroll auto-delivered #${refreshedOrder.order_id}:`, dispatchRes);
        } catch (tgErr) {
          console.error('[OrderPaymentService Crunchyroll Telegram Dispatch Error]:', tgErr);
        }

        return {
          success: true,
          order: refreshedOrder,
          deliveryType: 'STREAMING_AUTO',
          message: 'Crunchyroll preset account auto-delivered; order completed.'
        };
      }
    }

    // D. Default: Manual Service (PUBG QR/Login, eFootball, Movie Subscriptions, or Auto-Fulfill Fallback)
    // Update order status to PENDING_CLAIM and dispatch to Telegram Worker Group
    await db.updateOrderStatus(order.order_id, 'PENDING_CLAIM', {
      isAdminOverride: true,
      notes: `Payment Verified via ZiniPay (${paymentMethod} | TXN: ${trxId})`
    });

    const refreshedOrder = (await db.getOrderByCode(order.order_id)) || order;

    // Dispatch via FIFO Queue to Telegram Worker Group so staff can claim and fulfill!
    try {
      const dispatchRes = await telegramQueue.enqueueOrder(refreshedOrder);
      console.log(`[OrderPaymentService] Telegram Queue Dispatch Result for #${refreshedOrder.order_id}:`, dispatchRes);
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
    } finally {
      // Release in-process mutex after 5 seconds
      setTimeout(() => {
        activePaymentLocks.delete(lockKey);
      }, 5000);
    }
  }
};
