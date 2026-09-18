import { Payment, PaymentStatus, PaymentMethod } from '@/types';
import { getDbClient, isSupabaseConfigured } from '../client';
import { mockStore } from '../mock-store';
import { ordersRepository } from './orders';
import { usersRepository } from './users';
import { workersRepository } from './workers';
import { pricingRepository } from './pricing';

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
    const [orders, allProducts] = await Promise.all([
      ordersRepository.getOrders(),
      pricingRepository.getAllProducts()
    ]);

    // Product base cost lookup map (by ID and lowercased name)
    const productMap = new Map<string, { price: number; basePrice: number }>();
    for (const prod of allProducts) {
      productMap.set(prod.id.toLowerCase(), { price: prod.price, basePrice: prod.basePrice });
      productMap.set(prod.name.toLowerCase(), { price: prod.price, basePrice: prod.basePrice });
    }

    const helperGetOrderProfit = (order: any): { revenue: number; cost: number; profit: number } => {
      let revenue = Number(order.total_amount) || 0;
      let cost = 0;

      if (Array.isArray(order.items) && order.items.length > 0) {
        for (const item of order.items) {
          const qty = Number(item.quantity) || 1;
          const unitPrice = Number(item.unit_price) || (item.subtotal ? item.subtotal / qty : 0);
          const pName = (item.product_name || '').toLowerCase();
          const prodInfo = productMap.get(pName) || productMap.get(item.product_id?.toLowerCase());
          
          const unitBasePrice = prodInfo?.basePrice !== undefined 
            ? prodInfo.basePrice 
            : Math.round(unitPrice * 0.82);

          cost += unitBasePrice * qty;
        }
      } else {
        cost = Math.round(revenue * 0.82);
      }

      const profit = Math.max(0, revenue - cost);
      return { revenue, cost, profit };
    };

    const totalOrders = orders.length;
    const deliveredOrders = orders.filter(o => o.status === 'DELIVERED').length;
    const pendingOrders = orders.filter(o => o.status === 'PENDING_CLAIM' || o.status === 'CLAIMED' || o.status === 'PROCESSING').length;
    const cancelledOrders = orders.filter(o => o.status === 'CANCELLED').length;

    let totalRevenue = 0;
    let totalProfit = 0;
    let deliveredRevenue = 0;
    let deliveredProfit = 0;
    let pendingRevenue = 0;
    let pendingProfit = 0;

    for (const o of orders) {
      if (o.status === 'CANCELLED') continue;
      const { revenue, profit } = helperGetOrderProfit(o);
      totalRevenue += revenue;
      totalProfit += profit;

      if (o.status === 'DELIVERED') {
        deliveredRevenue += revenue;
        deliveredProfit += profit;
      } else if (['PENDING_CLAIM', 'CLAIMED', 'PROCESSING'].includes(o.status)) {
        pendingRevenue += revenue;
        pendingProfit += profit;
      }
    }

    // Today & This Month Calculations
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const thisMonthStr = now.toISOString().slice(0, 7);

    let todaySales = 0;
    let todayProfit = 0;
    let todayOrdersCount = 0;

    let thisMonthSales = 0;
    let thisMonthProfit = 0;
    let thisMonthOrdersCount = 0;

    // Daily Trend (Last 7 Days)
    const dailyMap = new Map<string, { date: string; displayDate: string; revenue: number; profit: number; orders: number; delivered: number }>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const displayDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyMap.set(key, { date: key, displayDate, revenue: 0, profit: 0, orders: 0, delivered: 0 });
    }

    // Monthly Trend (Last 6 Months)
    const monthlyMap = new Map<string, { monthKey: string; displayMonth: string; revenue: number; profit: number; orders: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      const displayMonth = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      monthlyMap.set(key, { monthKey: key, displayMonth, revenue: 0, profit: 0, orders: 0 });
    }

    // Package Popularity & Payment Breakdown
    const packageCountMap = new Map<string, { name: string; count: number; revenue: number; profit: number; margin: number }>();
    const paymentMap = new Map<string, { name: string; count: number; value: number }>();

    for (const o of orders) {
      if (o.status === 'CANCELLED') continue;
      const orderDate = o.created_at ? o.created_at.slice(0, 10) : '';
      const orderMonth = o.created_at ? o.created_at.slice(0, 7) : '';
      const { revenue, profit } = helperGetOrderProfit(o);

      if (orderDate === todayStr) {
        todaySales += revenue;
        todayProfit += profit;
        todayOrdersCount += 1;
      }

      if (orderMonth === thisMonthStr) {
        thisMonthSales += revenue;
        thisMonthProfit += profit;
        thisMonthOrdersCount += 1;
      }

      // Populate Daily
      if (dailyMap.has(orderDate)) {
        const item = dailyMap.get(orderDate)!;
        item.revenue += revenue;
        item.profit += profit;
        item.orders += 1;
        if (o.status === 'DELIVERED') item.delivered += 1;
      }

      // Populate Monthly
      if (monthlyMap.has(orderMonth)) {
        const item = monthlyMap.get(orderMonth)!;
        item.revenue += revenue;
        item.profit += profit;
        item.orders += 1;
      }

      // Populate Items
      if (Array.isArray(o.items)) {
        for (const it of o.items) {
          const pName = it.product_name || 'Top-Up';
          const prev = packageCountMap.get(pName) || { name: pName, count: 0, revenue: 0, profit: 0, margin: 0 };
          const qty = it.quantity || 1;
          const itemRev = it.subtotal || (it.unit_price * qty) || 0;
          const prodInfo = productMap.get(pName.toLowerCase());
          const unitBase = prodInfo?.basePrice !== undefined ? prodInfo.basePrice : Math.round((it.unit_price || 0) * 0.82);
          const itemProf = Math.max(0, itemRev - (unitBase * qty));

          prev.count += qty;
          prev.revenue += itemRev;
          prev.profit += itemProf;
          prev.margin = prev.revenue > 0 ? Math.round((prev.profit / prev.revenue) * 100) : 0;
          packageCountMap.set(pName, prev);
        }
      }

      // Populate Payment
      const method = o.payment_method || 'bKash';
      const prevPay = paymentMap.get(method) || { name: method, count: 0, value: 0 };
      prevPay.count += 1;
      prevPay.value += revenue;
      paymentMap.set(method, prevPay);
    }

    const workers = await workersRepository.getWorkers();
    const activeWorkers = workers.filter(w => w.is_active).length;

    const todayMargin = todaySales > 0 ? Math.round((todayProfit / todaySales) * 100) : 0;
    const thisMonthMargin = thisMonthSales > 0 ? Math.round((thisMonthProfit / thisMonthSales) * 100) : 0;
    const totalMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;

    return {
      totalOrders,
      deliveredOrders,
      pendingOrders,
      cancelledOrders,
      totalRevenue,
      deliveredRevenue,
      pendingRevenue,
      totalProfit,
      deliveredProfit,
      pendingProfit,
      totalMargin,
      todaySales,
      todayProfit,
      todayMargin,
      todayOrdersCount,
      thisMonthSales,
      thisMonthProfit,
      thisMonthMargin,
      thisMonthOrdersCount,
      dailyTrend: Array.from(dailyMap.values()),
      monthlyTrend: Array.from(monthlyMap.values()),
      topPackages: Array.from(packageCountMap.values()).sort((a, b) => b.count - a.count).slice(0, 5),
      paymentBreakdown: Array.from(paymentMap.values()),
      activeWorkers,
      totalWorkers: workers.length
    };
  },

  async getDashboardAnalytics() {
    return this.getAnalyticsSummary();
  }
};
