import { Payment, PaymentStatus, PaymentMethod } from '@/types';
import { connectToDatabase, isDbConfigured } from '../client';
import { OrderModel } from '../models/Order';
import { mockStore } from '../mock-store';
import { ordersRepository } from './orders';
import { pricingRepository } from './pricing';
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
    const [orders, allProducts, workers] = await Promise.all([
      ordersRepository.getOrders(),
      pricingRepository.getAllProducts(),
      workersRepository.getWorkers().catch(() => [])
    ]);

    // Product base cost lookup map (by ID and lowercased name)
    const productMap = new Map<string, { price: number; basePrice: number }>();
    for (const prod of allProducts) {
      productMap.set(prod.id.toLowerCase(), { price: prod.price, basePrice: prod.basePrice });
      productMap.set(prod.name.toLowerCase(), { price: prod.price, basePrice: prod.basePrice });
    }

    // Unit base (cost) price:
    //  1. Snapshot stored on the order item (orders created after the snapshot fix) — exact.
    //  2. Legacy orders: apply the package's CURRENT cost ratio (base ÷ price) to the price the
    //     order actually sold at. Using today's absolute base price would turn old sales made at
    //     older (lower) prices into fake losses whenever price + base were raised since.
    //  3. Unknown package: 82% estimate.
    const getItemUnitBasePrice = (item: any, unitPrice: number): number => {
      if (item.base_price !== null && item.base_price !== undefined && Number.isFinite(Number(item.base_price))) {
        return Number(item.base_price);
      }
      const prodInfo =
        productMap.get((item.product_id || '').toLowerCase()) ||
        productMap.get((item.product_name || '').toLowerCase());
      if (prodInfo && prodInfo.price > 0 && unitPrice > 0) {
        return Math.round(unitPrice * (prodInfo.basePrice / prodInfo.price));
      }
      return prodInfo?.basePrice !== undefined ? prodInfo.basePrice : Math.round(unitPrice * 0.82);
    };

    const getItemUnitPrice = (item: any): number => {
      const qty = Number(item.quantity) || 1;
      return Number(item.unit_price) || (item.subtotal ? item.subtotal / qty : 0);
    };

    // Profit = sell price − base price. Can be negative (sold below cost).
    const helperGetOrderProfit = (order: any): { revenue: number; cost: number; profit: number } => {
      const revenue = Number(order.total_amount) || 0;
      let cost = 0;

      if (Array.isArray(order.items) && order.items.length > 0) {
        for (const item of order.items) {
          const qty = Number(item.quantity) || 1;
          cost += getItemUnitBasePrice(item, getItemUnitPrice(item)) * qty;
        }
      } else {
        cost = Math.round(revenue * 0.82);
      }

      return { revenue, cost, profit: revenue - cost };
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
      // Revenue/profit are realized only once an order is DELIVERED.
      // Unpaid (PENDING_PAYMENT) and cancelled orders never count.
      if (o.status === 'CANCELLED') continue;
      const { revenue, profit } = helperGetOrderProfit(o);

      if (o.status === 'DELIVERED') {
        totalRevenue += revenue;
        totalProfit += profit;
        deliveredRevenue += revenue;
        deliveredProfit += profit;
      } else if (['PENDING_CLAIM', 'CLAIMED', 'PROCESSING'].includes(o.status)) {
        // Paid but not yet delivered: shown separately, excluded from totals
        pendingRevenue += revenue;
        pendingProfit += profit;
      }
    }

    // Helper functions for timezone-resilient date string extraction
    const getFormattedDateKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const getFormattedMonthKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const getUtcDateKey = (d: Date) =>
      d.toISOString().slice(0, 10);
    const getUtcMonthKey = (d: Date) =>
      d.toISOString().slice(0, 7);

    const now = new Date();
    const todayLocalKey = getFormattedDateKey(now);
    const todayUtcKey = getUtcDateKey(now);
    const thisMonthLocalKey = getFormattedMonthKey(now);
    const thisMonthUtcKey = getUtcMonthKey(now);

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
      const dateKey = getFormattedDateKey(d);
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
    const monthlyMap = new Map<string, { monthKey: string; month: string; displayMonth: string; revenue: number; profit: number; orders: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = getFormattedMonthKey(d);
      const displayMonth = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      monthlyMap.set(monthKey, {
        monthKey,
        month: monthKey,
        displayMonth,
        revenue: 0,
        profit: 0,
        orders: 0
      });
    }

    // Top Selling Packages Map with margin calculation
    const packageCountMap = new Map<string, { name: string; count: number; revenue: number; profit: number; margin: number }>();
    // Payment Breakdown Map
    const paymentMap = new Map<string, { name: string; count: number; value: number }>();

    for (const o of orders) {
      // Only completed orders contribute to profit/sales trends
      if (o.status !== 'DELIVERED') continue;

      // Bucket by completion time; legacy orders without delivered_at fall back to last update / creation
      const oDateRaw = o.delivered_at || o.updated_at || o.created_at;
      const oDate = oDateRaw ? new Date(oDateRaw) : null;
      const isValidDate = Boolean(oDate && !isNaN(oDate.getTime()));
      const oDateLocal = isValidDate ? getFormattedDateKey(oDate!) : '';
      const oDateUtc = isValidDate ? getUtcDateKey(oDate!) : '';
      const oMonthLocal = isValidDate ? getFormattedMonthKey(oDate!) : '';
      const oMonthUtc = isValidDate ? getUtcMonthKey(oDate!) : '';

      const { revenue, profit } = helperGetOrderProfit(o);

      // Check if order belongs to today (checking both local & UTC dates)
      if (isValidDate && (oDateLocal === todayLocalKey || oDateUtc === todayUtcKey)) {
        todaySales += revenue;
        todayProfit += profit;
        todayOrdersCount++;
      }

      // Check if order belongs to this month (checking both local & UTC months)
      if (isValidDate && (oMonthLocal === thisMonthLocalKey || oMonthUtc === thisMonthUtcKey)) {
        thisMonthSales += revenue;
        thisMonthProfit += profit;
        thisMonthOrdersCount++;
      }

      // Aggregate into Daily Trend
      if (isValidDate) {
        const dKey = dailyMap.has(oDateLocal)
          ? oDateLocal
          : dailyMap.has(oDateUtc)
          ? oDateUtc
          : null;
        if (dKey && dailyMap.has(dKey)) {
          const item = dailyMap.get(dKey)!;
          item.revenue += revenue;
          item.profit += profit;
          item.orders++;
          if (o.status === 'DELIVERED') item.delivered++;
        }
      }

      // Aggregate into Monthly Trend
      if (isValidDate) {
        const mKey = monthlyMap.has(oMonthLocal)
          ? oMonthLocal
          : monthlyMap.has(oMonthUtc)
          ? oMonthUtc
          : null;
        if (mKey && monthlyMap.has(mKey)) {
          const item = monthlyMap.get(mKey)!;
          item.revenue += revenue;
          item.profit += profit;
          item.orders++;
        }
      }

      // Aggregate Package Popularity & Profit
      if (Array.isArray(o.items)) {
        for (const item of o.items) {
          const pName = item.product_name || 'Top-Up Item';
          const qty = Number(item.quantity) || 1;
          const uPrice = getItemUnitPrice(item);
          const itemRev = uPrice * qty;
          const itemCost = getItemUnitBasePrice(item, uPrice) * qty;
          const itemProfit = itemRev - itemCost;

          const prev = packageCountMap.get(pName) || { name: pName, count: 0, revenue: 0, profit: 0, margin: 0 };
          prev.count += qty;
          prev.revenue += itemRev;
          prev.profit += itemProfit;
          prev.margin = prev.revenue > 0 ? Math.round((prev.profit / prev.revenue) * 100) : 0;
          packageCountMap.set(pName, prev);
        }
      }

      // Aggregate Payment Breakdown
      const rawMethod = o.payment_method || (o.delivery_address as any)?.payment_method || 'bKash';
      const cleanMethod = rawMethod.trim().toUpperCase();
      const displayMethodName = cleanMethod.includes('NAGAD')
        ? 'Nagad'
        : cleanMethod.includes('ROCKET')
        ? 'Rocket'
        : cleanMethod.includes('UPAY')
        ? 'Upay'
        : cleanMethod.includes('BKASH')
        ? 'bKash'
        : rawMethod;

      const prevPay = paymentMap.get(displayMethodName) || { name: displayMethodName, count: 0, value: 0 };
      prevPay.count += 1;
      prevPay.value += revenue;
      paymentMap.set(displayMethodName, prevPay);
    }

    const topPackages = Array.from(packageCountMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const paymentBreakdown = Array.from(paymentMap.values())
      .sort((a, b) => b.value - a.value);

    const activeWorkers = workers.filter(w => w.is_active).length;
    const totalWorkers = workers.length;

    const overallMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;
    const deliveredMargin = deliveredRevenue > 0 ? Math.round((deliveredProfit / deliveredRevenue) * 100) : 0;
    const todayMargin = todaySales > 0 ? Math.round((todayProfit / todaySales) * 100) : 0;
    const thisMonthMargin = thisMonthSales > 0 ? Math.round((thisMonthProfit / thisMonthSales) * 100) : 0;

    const dailyTrend = Array.from(dailyMap.values());
    const monthlyTrend = Array.from(monthlyMap.values());

    const overview = {
      totalOrders,
      deliveredOrders,
      pendingOrders,
      cancelledOrders,
      completionRate: totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0,
      totalRevenue,
      deliveredRevenue,
      pendingRevenue,
      totalProfit,
      deliveredProfit,
      pendingProfit,
      totalMargin: overallMargin,
      overallMargin,
      deliveredMargin,
      todaySales,
      todayProfit,
      todayMargin,
      todayOrdersCount,
      thisMonthSales,
      thisMonthProfit,
      thisMonthMargin,
      thisMonthOrdersCount,
      activeWorkers,
      totalWorkers
    };

    return {
      // 1. Direct top-level properties for src/app/page.tsx
      ...overview,
      dailyTrend,
      monthlyTrend,
      topPackages,
      paymentBreakdown,

      // 2. Compatibility aliases and nested overview
      overview,
      dailyTrends: dailyTrend,
      monthlyTrends: monthlyTrend,
      topSellingPackages: topPackages.map(p => ({
        name: p.name,
        quantity: p.count,
        revenue: p.revenue,
        profit: p.profit,
        margin: p.margin
      }))
    };
  }
};
