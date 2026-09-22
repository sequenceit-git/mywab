import { Order } from '@/types';
import { db } from '../db';
import { telegramBot } from './bot';
import { env } from '../config/env';

/**
 * Sequential FIFO Dispatch Queue for Telegram Worker Group
 * - Allows unlimited concurrent WhatsApp order intake
 * - Ensures only ONE (1) unclaimed order card is active in the Telegram Worker Group at a time
 * - Automatically dispatches the next oldest pending order the moment the active one is claimed/completed/cancelled
 */
class TelegramOrderQueue {
  private isProcessing = false;

  /**
   * Enqueue a newly created order from WhatsApp (or manual fallback)
   */
  async enqueueOrder(order: Order): Promise<{ dispatched: boolean; queuePosition?: number }> {
    if (!env.telegram.isConfigured) {
      console.log('[Telegram Queue] Telegram not configured, skipping queue dispatch.');
      return { dispatched: false };
    }

    try {
      // 1. Check if there is already an unclaimed order active in the Telegram group
      const activeUnclaimed = await db.getActiveTelegramUnclaimedOrder();

      if (!activeUnclaimed) {
        // No active order waiting for claim in group -> Dispatch immediately!
        console.log(`[Telegram Queue] No active unclaimed order in group. Dispatching Order #${order.order_id} immediately...`);
        const queueCount = await db.getUndispatchedQueueCount();
        const dispatchResult = await telegramBot.dispatchNewOrder(order, queueCount);
        return { dispatched: Boolean(dispatchResult.success), queuePosition: 1 };
      }

      // There is already an active unclaimed order -> Keep this order in DB queue (telegram_message_id is null)
      const queueCount = await db.getUndispatchedQueueCount();
      console.log(`[Telegram Queue] Group busy with active Order #${activeUnclaimed.order_id}. Order #${order.order_id} enqueued (Queue Depth: ${queueCount}).`);

      // Update the currently active order card to show the updated queue depth badge
      await this.refreshActiveCardQueueBadge(activeUnclaimed);

      return { dispatched: false, queuePosition: queueCount };
    } catch (err) {
      console.error('[Telegram Queue enqueueOrder Exception]:', err);
      return { dispatched: false };
    }
  }

  /**
   * Pull and dispatch the next order in the queue
   * Called automatically when an order is claimed, delivered, or cancelled
   */
  async processNextInQueue(): Promise<boolean> {
    if (this.isProcessing) return false;
    this.isProcessing = true;

    try {
      if (!env.telegram.isConfigured) return false;

      // 1. Check if an unclaimed order is still active
      const activeUnclaimed = await db.getActiveTelegramUnclaimedOrder();
      if (activeUnclaimed) {
        console.log(`[Telegram Queue] Active unclaimed order #${activeUnclaimed.order_id} still waiting for worker claim. Skipping next dispatch.`);
        await this.refreshActiveCardQueueBadge(activeUnclaimed);
        return false;
      }

      // 2. Fetch the next oldest pending order from the queue
      const nextOrder = await db.getNextQueuedOrder();
      if (!nextOrder) {
        console.log('[Telegram Queue] Queue is empty. No pending orders waiting.');
        return false;
      }

      const remainingQueueCount = await db.getUndispatchedQueueCount();
      console.log(`[Telegram Queue] Dispatching next order #${nextOrder.order_id} from queue (Remaining in line: ${remainingQueueCount - 1})...`);

      const result = await telegramBot.dispatchNewOrder(nextOrder, Math.max(0, remainingQueueCount - 1));
      return Boolean(result.success);
    } catch (err) {
      console.error('[Telegram Queue processNextInQueue Exception]:', err);
      return false;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Refresh the active unclaimed card in Telegram to display the live queue badge
   */
  async refreshActiveCardQueueBadge(activeOrder: Order): Promise<void> {
    if (!env.telegram.isConfigured || !activeOrder.telegram_message_id) return;

    try {
      const queueCount = await db.getUndispatchedQueueCount();
      const workerName = activeOrder.current_worker?.full_name;
      const { cardHtml, replyMarkup } = telegramBot.generateOrderCard(activeOrder, workerName, queueCount);

      await telegramBot.editMessageText(
        env.telegram.workerGroupId,
        activeOrder.telegram_message_id,
        cardHtml,
        replyMarkup
      );
    } catch (err) {
      console.warn('[Telegram Queue refreshActiveCardQueueBadge Warning]:', err);
    }
  }
}

export const telegramQueue = new TelegramOrderQueue();
