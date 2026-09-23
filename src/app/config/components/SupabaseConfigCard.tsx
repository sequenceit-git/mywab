'use client';

import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { SupabaseIcon } from '@/components/BrandIcons';
import { SystemStatus } from '../types';

interface SupabaseConfigCardProps {
  status: SystemStatus | null;
}

export const SupabaseConfigCard: React.FC<SupabaseConfigCardProps> = ({ status }) => {
  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-dark-900/90 border border-slate-800/80 space-y-4 shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
            <SupabaseIcon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">Supabase PostgreSQL</h4>
            <p className="text-[11px] text-slate-400">Database, RLS & Atomic Locking</p>
          </div>
        </div>
        <span
          className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0 ${
            status?.supabase?.connected
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          }`}
        >
          <CheckCircle2 className="w-3 h-3" />
          {status?.supabase?.connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/60 space-y-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-400 shrink-0">Database URL:</span>
          <span className="font-mono text-slate-200 text-[11px] truncate max-w-[200px] sm:max-w-[240px]">
            {status?.supabase?.url || 'Not set'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-400 shrink-0">Service Role Key:</span>
          <span className="font-mono text-slate-400 text-[11px]">
            {status?.supabase?.serviceRoleKeyMasked || 'Not Configured'}
          </span>
        </div>
      </div>

      {/* Real Database Table Stats */}
      <div className="pt-2 border-t border-slate-800/60">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">Live Table Row Counts</span>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/40">
            <div className="text-base font-extrabold text-white">{status?.supabase?.stats?.faqsCount ?? 0}</div>
            <div className="text-[10px] text-slate-400">FAQs / Q&A</div>
          </div>
          <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/40">
            <div className="text-base font-extrabold text-brand-400">{status?.supabase?.stats?.ordersCount ?? 0}</div>
            <div className="text-[10px] text-slate-400">Orders</div>
          </div>
          <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/40">
            <div className="text-base font-extrabold text-telegram-500">{status?.supabase?.stats?.workersCount ?? 0}</div>
            <div className="text-[10px] text-slate-400">Workers</div>
          </div>
        </div>
      </div>
    </div>
  );
};
