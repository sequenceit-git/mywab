'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import {
  Users,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Send,
  Plus,
  Bot,
  RefreshCw
} from 'lucide-react';
import { Worker } from '@/types';
import { TelegramIcon } from '@/components/BrandIcons';

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWorkers = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch('/api/workers', {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (data.success && Array.isArray(data.workers)) {
          setWorkers(data.workers);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
    const interval = setInterval(() => {
      fetchWorkers();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-950">
      <Header
        title="Telegram Worker Team & Permissions"
        subtitle="Manage fulfillment staff, Telegram IDs, and claim assignments"
      />

      <main className="p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-4 sm:space-y-6 pb-20 lg:pb-6">
        {/* Telegram Architecture Guide Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-telegram-500/10 border border-telegram-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-telegram-500/20 text-telegram-500 shrink-0 mt-0.5">
              <TelegramIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white">How Workers Connect via Telegram</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Auto-Payment Integrated
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl">
                Workers join the designated <b>Telegram Worker Group</b>. Orders paid through <b>ZiniPay Gateway</b> are automatically marked as <b className="text-emerald-400">🟢 [AUTO-PAID]</b> with their Invoice ID so workers know payment is 100% verified without checking SMS. Workers tap <b>[⚡ Claim Order]</b> to lock and fulfill.
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-slate-400 font-mono">
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">/stats</span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">/check &lt;order_id&gt;</span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">/gateway</span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">/cancel &lt;id&gt; &lt;reason&gt;</span>
              </div>
            </div>
          </div>
        </div>

        {/* Worker Section */}
        <div className="p-4 sm:p-5 rounded-2xl bg-dark-900/90 border border-slate-800/80 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-base">Active Fulfillment Staff</h3>
              <span className="text-xs text-slate-400">{workers.length} Registered Workers</span>
            </div>
            <button
              onClick={() => fetchWorkers(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-brand-400' : ''}`} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>

          {/* Mobile Worker Cards (md:hidden) */}
          <div className="md:hidden space-y-3">
            {loading ? (
              <div className="p-8 text-center text-slate-500 text-xs">Loading worker roster...</div>
            ) : workers.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2 bg-slate-950/40 rounded-xl border border-slate-800">
                <p className="text-xs font-semibold text-slate-300">No Telegram workers registered yet</p>
                <p className="text-[11px] text-slate-500">When workers join your Telegram Worker Group and claim dispatched orders, their profiles will automatically appear here with live statistics.</p>
              </div>
            ) : (
              workers.map((w) => (
                <div key={w.id} className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/70 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-white text-sm">{w.full_name}</div>
                      <div className="text-xs font-mono text-telegram-500 flex items-center gap-1">
                        <TelegramIcon className="w-3 h-3" />
                        <span>@{w.telegram_username || 'n/a'}</span>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      Active
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-xl bg-dark-900 border border-slate-800/60">
                      <span className="text-[10px] uppercase text-slate-400 font-medium block">Active Claims</span>
                      <span className="font-bold text-amber-400 text-sm">{w.active_orders || 0}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-dark-900 border border-slate-800/60">
                      <span className="text-[10px] uppercase text-slate-400 font-medium block">Completed</span>
                      <span className="font-extrabold text-brand-400 text-sm">{w.total_completed_orders || 0}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/50">
                    <span>ID: <b className="font-mono text-slate-300">{w.telegram_user_id}</b></span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-semibold border border-slate-700">
                      {w.role}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Worker Table (hidden on mobile) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Staff Name</th>
                  <th className="p-3.5">Telegram Username</th>
                  <th className="p-3.5">Telegram User ID</th>
                  <th className="p-3.5">Role</th>
                  <th className="p-3.5 text-center">Active Orders</th>
                  <th className="p-3.5 text-center">Completed Orders</th>
                  <th className="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">Loading worker roster...</td>
                  </tr>
                ) : workers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-slate-400 space-y-2">
                      <p className="text-xs font-semibold text-slate-300">No Telegram workers registered yet</p>
                      <p className="text-[11px] text-slate-500">When workers join your Telegram Worker Group and claim dispatched orders, their profiles will automatically appear here with live statistics.</p>
                    </td>
                  </tr>
                ) : workers.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-800/30 transition">
                    <td className="p-3.5 font-bold text-white">{w.full_name}</td>
                    <td className="p-3.5 font-mono text-telegram-500">@{w.telegram_username || 'n/a'}</td>
                    <td className="p-3.5 font-mono text-slate-400">{w.telegram_user_id}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold border border-slate-700">
                        {w.role}
                      </span>
                    </td>
                    <td className="p-3.5 text-center font-bold text-amber-400">{w.active_orders || 0}</td>
                    <td className="p-3.5 text-center font-extrabold text-brand-400">{w.total_completed_orders || 0}</td>
                    <td className="p-3.5">
                      <span className="inline-flex items-center gap-1.5 text-emerald-400 text-[11px] font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
