'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import {
  TrendingUp,
  ShoppingBag,
  Calendar,
  CheckCircle2,
  Users,
  ArrowRight,
  DollarSign,
  Package,
  CreditCard,
  BarChart3,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { Order, Worker } from '@/types';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface AnalyticsData {
  totalOrders: number;
  deliveredOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  deliveredRevenue: number;
  pendingRevenue: number;
  todaySales: number;
  todayOrdersCount: number;
  thisMonthSales: number;
  thisMonthOrdersCount: number;
  dailyTrend: Array<{ date: string; displayDate: string; revenue: number; orders: number; delivered: number }>;
  monthlyTrend: Array<{ monthKey: string; displayMonth: string; revenue: number; orders: number }>;
  topPackages: Array<{ name: string; count: number; revenue: number }>;
  paymentBreakdown: Array<{ name: string; count: number; value: number }>;
  activeWorkers: number;
  totalWorkers: number;
}

export default function DashboardOverviewPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartView, setChartView] = useState<'daily' | 'monthly'>('daily');

  const fetchDashboardData = async () => {
    try {
      const [resAnalytics, resWorkers] = await Promise.all([
        fetch('/api/analytics'),
        fetch('/api/workers')
      ]);
      const dataAnalytics = await resAnalytics.json();
      if (dataAnalytics.success) setAnalytics(dataAnalytics.stats);

      const dataWorkers = await resWorkers.json();
      if (dataWorkers.success) setWorkers(dataWorkers.workers);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 6000);
    return () => clearInterval(interval);
  }, []);

  const todaySales = analytics?.todaySales || 0;
  const todayOrders = analytics?.todayOrdersCount || 0;
  const thisMonthSales = analytics?.thisMonthSales || 0;
  const thisMonthOrders = analytics?.thisMonthOrdersCount || 0;
  const totalRevenue = analytics?.totalRevenue || 0;
  const totalOrders = analytics?.totalOrders || 0;
  const deliveredOrders = analytics?.deliveredOrders || 0;

  const chartData = chartView === 'daily'
    ? (analytics?.dailyTrend || [])
    : (analytics?.monthlyTrend || []);

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Sales & Operations Hub"
        subtitle="Daily & monthly revenue metrics, top-up performance, and worker fulfillment"
      />

      <main className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Architecture Pipeline Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-brand-950/60 via-dark-900 to-indigo-950/60 border border-brand-500/20 p-5 shadow-xl backdrop-blur-md relative overflow-hidden">
          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-400 animate-pulse"></span>
                <span className="text-xs font-bold uppercase tracking-wider text-brand-400">Store Analytics Active</span>
              </div>
              <h3 className="text-lg font-bold text-white">PUBG Mobile Top-Up Sales & Dispatch Operations</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Real-time tracking of daily revenue, customer orders across WhatsApp AI, and Telegram fulfillment metrics.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/orders"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 text-dark-950 font-bold text-xs hover:bg-brand-400 transition-all shadow-lg shadow-brand-500/25"
              >
                <span>View All Orders</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* 4 Core Sales KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Today's Sales */}
          <div className="p-5 rounded-2xl bg-dark-900/90 border border-slate-800/80 shadow-md relative overflow-hidden group hover:border-emerald-500/40 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Today's Sales</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-emerald-400">৳{todaySales.toLocaleString()}</div>
              <p className="text-[11px] text-slate-400 mt-1">
                <b className="text-slate-200">{todayOrders}</b> orders received today
              </p>
            </div>
          </div>

          {/* This Month's Sales */}
          <div className="p-5 rounded-2xl bg-dark-900/90 border border-slate-800/80 shadow-md relative overflow-hidden group hover:border-sky-500/40 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">This Month</span>
              <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
                <Calendar className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-sky-400">৳{thisMonthSales.toLocaleString()}</div>
              <p className="text-[11px] text-slate-400 mt-1">
                <b className="text-slate-200">{thisMonthOrders}</b> orders this month
              </p>
            </div>
          </div>

          {/* Total All-Time Revenue */}
          <div className="p-5 rounded-2xl bg-dark-900/90 border border-slate-800/80 shadow-md relative overflow-hidden group hover:border-brand-500/40 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">All-Time Revenue</span>
              <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-white">৳{totalRevenue.toLocaleString()}</div>
              <p className="text-[11px] text-slate-400 mt-1">
                From <b className="text-slate-200">{totalOrders}</b> total orders
              </p>
            </div>
          </div>

          {/* Completed Orders */}
          <div className="p-5 rounded-2xl bg-dark-900/90 border border-slate-800/80 shadow-md relative overflow-hidden group hover:border-purple-500/40 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Delivered Top-Ups</span>
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-purple-400">{deliveredOrders}</div>
              <p className="text-[11px] text-slate-400 mt-1">
                {analytics?.pendingOrders || 0} currently in pipeline
              </p>
            </div>
          </div>
        </div>

        {/* 2-Column Main Section: Charts & Analytics + Side Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chart Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Sales Revenue Trend Chart */}
            <div className="rounded-2xl bg-dark-900/90 border border-slate-800/80 p-5 shadow-lg space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-brand-400" />
                    <h3 className="font-bold text-white text-base">Sales & Revenue Trend</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {chartView === 'daily' ? 'Daily revenue over the last 7 days' : 'Monthly revenue over the last 6 months'}
                  </p>
                </div>

                {/* View Switcher Tabs */}
                <div className="flex items-center p-1 bg-slate-950/80 border border-slate-800/80 rounded-xl">
                  <button
                    onClick={() => setChartView('daily')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      chartView === 'daily'
                        ? 'bg-brand-500 text-dark-950 shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Daily (7 Days)
                  </button>
                  <button
                    onClick={() => setChartView('monthly')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      chartView === 'monthly'
                        ? 'bg-brand-500 text-dark-950 shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Monthly (6 Months)
                  </button>
                </div>
              </div>

              {/* Chart Visual Container */}
              <div className="h-72 w-full pt-2">
                {loading ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    Loading sales charts...
                  </div>
                ) : chartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500">
                    No sales data recorded yet.
                  </div>
                ) : chartView === 'daily' ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorDailyRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis
                        dataKey="displayDate"
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `৳${value}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#090d16',
                          borderColor: '#334155',
                          borderRadius: '12px',
                          fontSize: '12px',
                          color: '#f8fafc',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                        }}
                        formatter={(value: any) => [`৳${Number(value).toLocaleString()}`, 'Revenue']}
                        labelFormatter={(label) => `Date: ${label}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorDailyRevenue)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis
                        dataKey="displayMonth"
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `৳${value}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#090d16',
                          borderColor: '#334155',
                          borderRadius: '12px',
                          fontSize: '12px',
                          color: '#f8fafc',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                        }}
                        formatter={(value: any) => [`৳${Number(value).toLocaleString()}`, 'Monthly Sales']}
                        labelFormatter={(label) => `Month: ${label}`}
                      />
                      <Bar
                        dataKey="revenue"
                        fill="#38bdf8"
                        radius={[6, 6, 0, 0]}
                        barSize={36}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Product & Payment Breakdown Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Top Selling Packages */}
              <div className="p-5 rounded-2xl bg-dark-900/90 border border-slate-800/80 shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-brand-400" />
                    <h4 className="font-bold text-white text-sm">Top Packages</h4>
                  </div>
                  <span className="text-[11px] text-slate-400">By units sold</span>
                </div>

                <div className="space-y-2.5 pt-1">
                  {(!analytics?.topPackages || analytics.topPackages.length === 0) ? (
                    <div className="py-6 text-center text-slate-500 text-xs">No package data available</div>
                  ) : (
                    analytics.topPackages.map((pkg, i) => {
                      const maxUnits = analytics.topPackages[0]?.count || 1;
                      const percentage = Math.round((pkg.count / maxUnits) * 100);
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-200">{pkg.name}</span>
                            <div className="text-right">
                              <b className="text-brand-400">{pkg.count} sold</b>
                              <span className="text-[10px] text-slate-500 ml-1.5">(৳{pkg.revenue})</span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-brand-500 to-emerald-400 h-1.5 rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Payment Methods Breakdown */}
              <div className="p-5 rounded-2xl bg-dark-900/90 border border-slate-800/80 shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                    <h4 className="font-bold text-white text-sm">Payment Methods</h4>
                  </div>
                  <span className="text-[11px] text-slate-400">By revenue</span>
                </div>

                <div className="space-y-2.5 pt-1">
                  {(!analytics?.paymentBreakdown || analytics.paymentBreakdown.length === 0) ? (
                    <div className="py-6 text-center text-slate-500 text-xs">No payment data available</div>
                  ) : (
                    analytics.paymentBreakdown.map((pay, i) => {
                      const totalPayVal = analytics.totalRevenue || 1;
                      const percentage = Math.min(100, Math.round((pay.value / totalPayVal) * 100));
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-200">{pay.name}</span>
                            <div className="text-right">
                              <b className="text-emerald-400">৳{pay.value.toLocaleString()}</b>
                              <span className="text-[10px] text-slate-500 ml-1.5">({pay.count} orders)</span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-emerald-500 to-sky-400 h-1.5 rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Workers & Fast Links */}
          <div className="space-y-6">
            {/* Telegram Worker Activity */}
            <div className="rounded-2xl bg-dark-900/90 border border-slate-800/80 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-telegram-500/10 text-telegram-500">
                    <Users className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-white text-sm">Telegram Workers</h3>
                </div>
                <Link href="/workers" className="text-xs text-telegram-500 hover:underline">
                  Manage
                </Link>
              </div>

              <div className="space-y-2">
                {workers.length === 0 ? (
                  <div className="py-6 px-4 text-center rounded-xl bg-slate-950/40 border border-slate-800/40 space-y-1">
                    <p className="text-xs text-slate-400 font-medium">No workers registered yet</p>
                    <p className="text-[11px] text-slate-500">Staff will appear here when they claim orders in Telegram.</p>
                  </div>
                ) : (
                  workers.map((worker) => (
                    <div
                      key={worker.id}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-200">{worker.full_name}</div>
                        <div className="text-[10px] text-telegram-500 font-mono">@{worker.telegram_username || 'no_username'}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-extrabold text-emerald-400">{worker.total_completed_orders || 0} completed</div>
                        <div className="text-[10px] text-slate-400">{worker.active_orders || 0} in progress</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick Navigation Card */}
            <div className="rounded-2xl bg-dark-900/90 border border-slate-800/80 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-400" />
                <h4 className="font-bold text-white text-sm">Quick Operations</h4>
              </div>
              <div className="grid grid-cols-1 gap-2 pt-1">
                <Link
                  href="/orders"
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 hover:border-brand-500/40 transition flex items-center justify-between group"
                >
                  <span className="text-xs font-medium text-slate-300 group-hover:text-white">Live Orders Management</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-brand-400" />
                </Link>
                <Link
                  href="/chat"
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 hover:border-brand-500/40 transition flex items-center justify-between group"
                >
                  <span className="text-xs font-medium text-slate-300 group-hover:text-white">Customer WhatsApp Chat</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-brand-400" />
                </Link>
                <Link
                  href="/qna"
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 hover:border-brand-500/40 transition flex items-center justify-between group"
                >
                  <span className="text-xs font-medium text-slate-300 group-hover:text-white">Store FAQs & Price Catalog</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-brand-400" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
