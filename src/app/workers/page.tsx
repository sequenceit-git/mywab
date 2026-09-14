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
    <div className="flex-1 flex flex-col">
      <Header
        title="Telegram Worker Team & Permissions"
        subtitle="Manage fulfillment staff, Telegram IDs, and claim assignments"
      />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Telegram Architecture Guide Card */}
        <div className="p-5 rounded-2xl bg-telegram-500/10 border border-telegram-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-telegram-500/20 text-telegram-500 shrink-0">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">How Workers Connect via Telegram</h3>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                Workers join the designated <b>Telegram Worker Group</b> where your bot is added. When a new order arrives, workers tap <b>[⚡ Claim Order]</b> directly in Telegram. The system atomically locks the order to their account and prevents any duplicate claims.
              </p>
            </div>
          </div>
        </div>

        {/* Worker Table */}
        <div className="p-5 rounded-2xl bg-dark-900/90 border border-slate-800/80 space-y-4">
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

          <div className="overflow-x-auto">
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
