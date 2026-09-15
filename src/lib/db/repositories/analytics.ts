import { Payment, PaymentStatus, PaymentMethod } from '@/types';
import { getDbClient, isSupabaseConfigured } from '../client';
import { mockStore } from '../mock-store';
import { ordersRepository } from './orders';
import { usersRepository } from './users';
import { workersRepository } from './workers';

export const analyticsRepository = {
  // PAYMENTS
  async createPayment(params: {
    orderId: string;
    amount: number;
    paymentMethod?: PaymentMethod | string;
    transactionRef?: string;
  }): Promise<Payment> {
    const paymentId = crypto.randomUUID();
    const newPayment: Payment = {
      id: paymentId,
      order_id: params.orderId,
      amount: params.amount,
      method: (params.paymentMethod as PaymentMethod) || 'BKASH',
      status: 'VERIFYING',
      transaction_id: params.transactionRef || null,
      created_at: new Date().toISOString()
    };

    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      await client.from('payments').insert(newPayment);
      return newPayment;
    }

    mockStore.payments.set(paymentId, newPayment);
    return newPayment;
  },

  async getPaymentsByOrder(orderId: string): Promise<Payment[]> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { data } = await client
        .from('payments')
        .select('*')
        .eq('order_id', orderId);
      if (data) return data;
    }
    return Array.from(mockStore.payments.values()).filter(p => p.order_id === orderId);
  },

  async updatePaymentStatus(paymentId: string, status: PaymentStatus): Promise<boolean> {
    const client = getDbClient();
    if (isSupabaseConfigured() && client) {
      const { error } = await client
        .from('payments')
        .update({ status })
        .eq('id', paymentId);
      return !error;
    }
    const p = mockStore.payments.get(paymentId);
    if (p) {
      p.status = status;
      return true;
    }
    return false;
  },

  // KPI & ANALYTICS SUMMARY
  async getAnalyticsSummary() {
    const orders = await ordersRepository.getOrders();
    const totalOrders = orders.length;
    const deliveredOrders = orders.filter(o => o.status === 'DELIVERED').length;
    const pendingOrders = orders.filter(o => o.status === 'PENDING_CLAIM' || o.status === 'CLAIMED' || o.status === 'PROCESSING').length;
    const cancelledOrders = orders.filter(o => o.status === 'CANCELLED').length;

    const totalRevenue = orders
      .filter(o => o.status === 'DELIVERED')
      .reduce((sum, o) => sum + (o.total_amount || 0), 0);

    const pendingRevenue = orders
      .filter(o => o.status === 'PENDING_CLAIM' || o.status === 'CLAIMED' || o.status === 'PROCESSING')
      .reduce((sum, o) => sum + (o.total_amount || 0), 0);

    const workers = await workersRepository.getWorkers();
    const activeWorkers = workers.filter(w => w.is_active).length;

    return {
      totalOrders,
      deliveredOrders,
      pendingOrders,
      cancelledOrders,
      totalRevenue,
      pendingRevenue,
      activeWorkers,
      totalWorkers: workers.length
    };
  },

  async getDashboardAnalytics() {
    return this.getAnalyticsSummary();
  }
};
