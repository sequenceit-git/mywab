import { Payment, PaymentStatus, PaymentMethod } from '@/types';
import { connectToDatabase, isDbConfigured } from '../client';
import { OrderModel } from '../models/Order';
import { mockStore } from '../mock-store';
import { ordersRepository } from './orders';
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

    if (isDbConfigured()) {
      try {
        await connectToDatabase();
        await OrderModel.updateOne(
          { $or: [{ id: params.orderId }, { order_id: params.orderId }] },
          { $push: { payments: newPayment } }
        );
        return newPayment;
      } catch (err) {
        console.error('[MongoDB createPayment error]:', err);
      }
    }

    mockStore.payments.set(paymentId, newPayment);
    return newPayment;
  },

  async getPaymentsByOrder(orderId: string): Promise<Payment[]> {
    if (isDbConfigured()) {
      try {
        await connectToDatabase();
        const order = await OrderModel.findOne({
          $or: [{ id: orderId }, { order_id: orderId }]
        }).lean();
        if (order && Array.isArray(order.payments) && order.payments.length > 0) {
          return order.payments as any;
        }
      } catch (err) {
        console.error('[MongoDB getPaymentsByOrder error]:', err);
      }
    }
    return Array.from(mockStore.payments.values()).filter(p => p.order_id === orderId);
  },

  async updatePaymentStatus(paymentId: string, status: PaymentStatus): Promise<boolean> {
    if (isDbConfigured()) {
      try {
        await connectToDatabase();
        await OrderModel.updateOne(
          { 'payments.id': paymentId },
          { $set: { 'payments.$.status': status } }
        );
        return true;
      } catch (err) {
        console.error('[MongoDB updatePaymentStatus error]:', err);
      }
    }
    const p = mockStore.payments.get(paymentId);
    if (p) {
      p.status = status;
      return true;
    }
    return false;
  },

  // KPI & ANALYTICS SUMMARY
  getDashboardAnalytics() {
    return this.getAnalyticsSummary();
  },

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
      const dateKey = d.toISOString().slice(0, 10);
      const displayDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyMap.set(dateKey, {
        date: dateKey,
        displayDate,
        revenue: 0,
        profit: 0,
        orders: 0,
        delivered: 0
      });
    }

    // Monthly Trend (Last 6 Months)
    const monthlyMap = new Map<string, { month: string; displayMonth: string; revenue: number; profit: number; orders: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = d.toISOString().slice(0, 7);
      const displayMonth = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      monthlyMap.set(monthKey, {
        month: monthKey,
        displayMonth,
        revenue: 0,
        profit: 0,
        orders: 0
      });
    }

    // Top Selling Packages Map
    const packageStatsMap = new Map<string, { name: string; quantity: number; revenue: number; profit: number }>();

    for (const o of orders) {
      if (o.status === 'CANCELLED') continue;

      const oDate = o.created_at ? o.created_at.slice(0, 10) : '';
      const oMonth = o.created_at ? o.created_at.slice(0, 7) : '';
      const { revenue, profit } = helperGetOrderProfit(o);

      if (oDate === todayStr) {
        todaySales += revenue;
        todayProfit += profit;
        todayOrdersCount++;
      }

      if (oMonth === thisMonthStr) {
        thisMonthSales += revenue;
        thisMonthProfit += profit;
        thisMonthOrdersCount++;
      }

      if (dailyMap.has(oDate)) {
        const item = dailyMap.get(oDate)!;
        item.revenue += revenue;
        item.profit += profit;
        item.orders++;
        if (o.status === 'DELIVERED') item.delivered++;
      }

      if (monthlyMap.has(oMonth)) {
        const item = monthlyMap.get(oMonth)!;
        item.revenue += revenue;
        item.profit += profit;
        item.orders++;
      }

      if (Array.isArray(o.items)) {
        for (const item of o.items) {
          const pName = item.product_name || 'Top-Up Item';
          const qty = Number(item.quantity) || 1;
          const uPrice = Number(item.unit_price) || 0;
          const itemRev = uPrice * qty;

          const prodInfo = productMap.get(pName.toLowerCase());
          const itemCost = (prodInfo?.basePrice !== undefined ? prodInfo.basePrice : Math.round(uPrice * 0.82)) * qty;
          const itemProfit = Math.max(0, itemRev - itemCost);

          if (!packageStatsMap.has(pName)) {
            packageStatsMap.set(pName, { name: pName, quantity: 0, revenue: 0, profit: 0 });
          }
          const pkg = packageStatsMap.get(pName)!;
          pkg.quantity += qty;
          pkg.revenue += itemRev;
          pkg.profit += itemProfit;
        }
      }
    }

    const topSellingPackages = Array.from(packageStatsMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const overallMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;
    const deliveredMargin = deliveredRevenue > 0 ? Math.round((deliveredProfit / deliveredRevenue) * 100) : 0;

    return {
      overview: {
        totalOrders,
        deliveredOrders,
        pendingOrders,
        cancelledOrders,
        completionRate: totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0,
        totalRevenue,
        totalProfit,
        overallMargin,
        deliveredRevenue,
        deliveredProfit,
        deliveredMargin,
        pendingRevenue,
        pendingProfit,
        todaySales,
        todayProfit,
        todayOrdersCount,
        thisMonthSales,
        thisMonthProfit,
        thisMonthOrdersCount
      },
      dailyTrends: Array.from(dailyMap.values()),
      monthlyTrends: Array.from(monthlyMap.values()),
      topSellingPackages
    };
  }
};
