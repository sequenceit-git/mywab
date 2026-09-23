import { Order, OrderStatus } from '@/types';
import { getDbClient, isSupabaseConfigured } from '../client';
import { mockStore } from '../mock-store';
import { hydrateOrder } from './orders/order-hydrator';
import { createOrder } from './orders/order-creator';
import {
  getOrders,
  getOrderByCode,
  getOrderById,
  getOrdersByPhone
} from './orders/order-query';
import {
  getNextQueuedOrder,
  getUndispatchedQueueCount,
  getActiveTelegramUnclaimedOrder
} from './orders/order-queue';
import {
  getOrderByInvoiceId,
  attachInvoiceToOrder,
  updateOrderPaymentSuccess
} from './orders/order-invoice';

export * from './orders/order-hydrator';
export * from './orders/order-creator';
export * from './orders/order-query';
export * from './orders/order-queue';
export * from './orders/order-invoice';

export const ordersRepository = {
  hydrateOrder,
  createOrder,
  getOrders,
  getOrderByCode,
  getOrderById,
  getOrdersByPhone,
  getNextQueuedOrder,
  getUndispatchedQueueCount,
  getActiveTelegramUnclaimedOrder,
  getOrderByInvoiceId,
  attachInvoiceToOrder,
  updateOrderPaymentSuccess,

  async updateOrderStatus(
    orderIdCode: string,
    status: OrderStatus,
    options?: {
      telegramUserId?: number;
      workerTelegramId?: number;
      isAdminOverride?: boolean;
      notes?: string;
      customerNotes?: string;
    }
  ): Promise<{ success: boolean; message: string; order?: Order }> {
    const order = await getOrderByCode(orderIdCode);
    if (!order) {
      return { success: false, message: 'অর্ডারটি খুঁজে পাওয়া যায়নি।' };
    }

    const { isAdminOverride = false, notes, customerNotes } = options || {};
    const telegramUserId = options?.telegramUserId ?? options?.workerTelegramId;
    const finalNotes = notes || customerNotes;

    // 1. Worker Lock Check: If not an admin override, verify that this worker owns the order
    if (!isAdminOverride && telegramUserId) {
      const isAssignedToThisWorker = order.current_worker?.telegram_user_id === telegramUserId;
      if (order.current_worker && !isAssignedToThisWorker) {
        const assignedName = order.current_worker.full_name || 'অন্য একজন কর্মী';
        return {
          success: false,
          message: `এই অর্ডারটি ইতোমধ্যে ${assignedName} ক্লেইম করেছেন। শুধুমাত্র তিনি অথবা অ্যাডমিন প্যানেল এটি পরিবর্তন করতে পারবেন।`
        };
      }
    }

    // 2. Admin Override Actions
    if (isAdminOverride && (status === 'PENDING_CLAIM' || status === 'PENDING_PAYMENT' || status === 'CANCELLED')) {
      if (status === 'PENDING_CLAIM' || status === 'PENDING_PAYMENT') {
        order.current_worker = undefined;
      }
    }

    const mergedNotes = finalNotes
      ? (order.customer_notes && !finalNotes.includes(order.customer_notes) && !order.customer_notes.includes(finalNotes)
          ? `${order.customer_notes} | ${finalNotes}`
          : finalNotes)
      : order.customer_notes;

    order.status = status;
    if (mergedNotes) {
      order.customer_notes = mergedNotes;
    }
    order.updated_at = new Date().toISOString();

    for (const o of mockStore.orders.values()) {
      if (o.order_id.toUpperCase() === orderIdCode.toUpperCase() || o.id === order.id) {
        o.status = status;
        if (mergedNotes) {
          o.customer_notes = mergedNotes;
        }
        o.updated_at = new Date().toISOString();
        if (status === 'PENDING_CLAIM' || status === 'PENDING_PAYMENT') {
          o.current_worker = undefined;
        }
        break;
      }
    }

    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const updatePayload: Record<string, any> = {
        status,
        updated_at: new Date().toISOString()
      };
      if (mergedNotes) {
        updatePayload.customer_notes = mergedNotes;
      }
      await client
        .from('orders')
        .update(updatePayload)
        .eq('id', order.id);
      
      if (status === 'DELIVERED') {
        await client
          .from('order_assignments')
          .update({ status: 'DELIVERED', completed_at: new Date().toISOString() })
          .eq('order_id', order.id);
      } else if (status === 'CANCELLED') {
        await client
          .from('order_assignments')
          .update({ status: 'CANCELLED', completed_at: new Date().toISOString() })
          .eq('order_id', order.id);
      }
    }

    return { success: true, message: `Status updated to ${status}`, order: hydrateOrder(order) };
  },

  async updateOrderTelegramMessageId(orderIdCodeOrId: string, messageId: number | null): Promise<void> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      await client
        .from('orders')
        .update({ telegram_message_id: messageId, updated_at: new Date().toISOString() })
        .or(`id.eq.${orderIdCodeOrId},order_id.eq.${orderIdCodeOrId}`);
    }

    for (const o of mockStore.orders.values()) {
      if (o.id === orderIdCodeOrId || o.order_id.toLowerCase() === orderIdCodeOrId.toLowerCase()) {
        o.telegram_message_id = messageId;
        break;
      }
    }
  }
};
