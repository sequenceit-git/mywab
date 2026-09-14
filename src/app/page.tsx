'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import {
  TrendingUp,
  ShoppingBag,
  Clock,
  CheckCircle2,
  Users,
  ArrowRight,
  ExternalLink,
  MessageSquare,
  Bot,
  Database
} from 'lucide-react';
import Link from 'next/link';
import { Order, Worker } from '@/types';

export default function DashboardOverviewPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const resOrders = await fetch('/api/orders');
      const dataOrders = await resOrders.json();
      if (dataOrders.success) setOrders(dataOrders.orders);

      const resWorkers = await fetch('/api/workers');
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
    const interval = setInterval(fetchDashboardData, 5000);
    return () => clearInterval(interval);
  }, []);

  const totalRevenue = orders
    .filter(o => o.status !== 'CANCELLED')
    .reduce((sum, o) => sum + Number(o.total_amount), 0);

  const pendingClaims = orders.filter(o => o.status === 'PENDING_CLAIM');
  const activeOrders = orders.filter(o => ['CLAIMED', 'PROCESSING', 'OUT_FOR_DELIVERY'].includes(o.status));
  const completedOrders = orders.filter(o => o.status === 'DELIVERED');

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Operations Hub"
        subtitle="Real-time oversight of WhatsApp AI ordering & Telegram worker dispatch"
      />

      <main className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Architecture Pipeline Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-brand-950/60 via-dark-900 to-indigo-950/60 border border-brand-500/20 p-5 shadow-xl backdrop-blur-md relative overflow-hidden">
          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-400 animate-pulse"></span>
                <span className="text-xs font-bold uppercase tracking-wider text-brand-400">System Architecture Active</span>
              </div>
              <h3 className="text-lg font-bold text-white">WhatsApp AI Commerce ➔ Telegram Worker Dispatch Engine</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Powered by <b>Supabase PostgreSQL</b>, <b>LangChain with OpenAI</b>, and <b>GrammY Telegram Bot</b> with zero race condition atomic order claiming.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/orders"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 text-dark-950 font-bold text-xs hover:bg-brand-400 transition-all shadow-lg shadow-brand-500/25"
              >
                <span>Manage Live Orders</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-dark-900/90 border border-slate-800/80 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Sales</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-white">৳{totalRevenue.toLocaleString()}</div>
              <p className="text-[11px] text-emerald-400 mt-1">From {orders.length} total orders</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-dark-900/90 border border-slate-800/80 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Claim</span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-amber-400">{pendingClaims.length}</div>
              <p className="text-[11px] text-slate-400 mt-1">Waiting in Telegram Group</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-dark-900/90 border border-slate-800/80 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">In Delivery / Active</span>
              <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
                <ShoppingBag className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-sky-400">{activeOrders.length}</div>
              <p className="text-[11px] text-slate-400 mt-1">Claimed & being fulfilled</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-dark-900/90 border border-slate-800/80 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Completed</span>
              <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-brand-400">{completedOrders.length}</div>
              <p className="text-[11px] text-slate-400 mt-1">Delivered to customers</p>
            </div>
          </div>
        </div>

        {/* 2 Column Main Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Orders Live Board */}
          <div className="lg:col-span-2 rounded-2xl bg-dark-900/90 border border-slate-800/80 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base">Live Order Stream</h3>
                <p className="text-xs text-slate-400">Synchronized across WhatsApp, Telegram, and Supabase</p>
              </div>
              <Link
                href="/orders"
                className="text-xs font-semibold text-brand-400 hover:text-brand-300 flex items-center gap-1"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-500 text-xs">Loading orders...</div>
            ) : orders.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">No orders placed yet.</div>
            ) : (
              <div className="space-y-2.5">
                {orders.slice(0, 5).map((order) => (
                  <div
                    key={order.id}
                    className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/70 hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white">{order.order_id}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            order.status === 'PENDING_CLAIM'
                              ? 'status-badge-pending'
                              : order.status === 'DELIVERED'
                              ? 'status-badge-delivered'
                              : 'status-badge-claimed'
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">
                        {order.customer?.name || order.delivery_address.name || 'Customer'} • {order.delivery_phone}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        📍 {order.delivery_address.address}
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                      <span className="text-sm font-black text-brand-400">৳{order.total_amount}</span>
                      <span className="text-[10px] text-slate-400">
                        {order.current_worker ? `Worker: ${order.current_worker.full_name}` : 'Unassigned'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Telegram Staff & System Flow Info */}
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
                    <p className="text-[11px] text-slate-500">Fulfillment staff will automatically appear here when they claim orders in your Telegram group.</p>
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

            {/* Live System Channels & Webhook Status */}
            <div className="rounded-2xl bg-dark-900/90 border border-slate-800/80 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-brand-400 font-bold text-xs uppercase tracking-wider">
                  <Database className="w-4 h-4" />
                  <span>Channel & Webhook Status</span>
                </div>
                <Link href="/config" className="text-xs text-brand-400 hover:underline">
                  Configure
                </Link>
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/50 flex items-center justify-between">
                  <span className="text-slate-300">WhatsApp Cloud Webhook</span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Active</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/50 flex items-center justify-between">
                  <span className="text-slate-300">Telegram Worker Dispatch</span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Active</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/50 flex items-center justify-between">
                  <span className="text-slate-300">Supabase DB & RLS</span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Connected</span>
                </div>
              </div>
              <Link
                href="/config"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition"
              >
                <span>View System Diagnostics</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
