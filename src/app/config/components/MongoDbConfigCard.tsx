'use client';

import React from 'react';
import { CheckCircle2, Database } from 'lucide-react';
import { SystemStatus } from '../types';

interface MongoDbConfigCardProps {
  status: SystemStatus | null;
}

export const MongoDbConfigCard: React.FC<MongoDbConfigCardProps> = ({ status }) => {
  const isConnected = status?.mongodb?.connected ?? false;
  const uriDisplay = status?.mongodb?.uriMasked || 'Configured via .env';
  const stats = status?.mongodb?.stats;

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-dark-900/90 border border-slate-800/80 space-y-4 shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
            <Database className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">MongoDB Atlas</h4>
            <p className="text-[11px] text-slate-400">Document Database & Atomic Locking</p>
          </div>
        </div>
        <span
          className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0 ${
            isConnected
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          }`}
        >
          <CheckCircle2 className="w-3 h-3" />
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/60 space-y-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-400 shrink-0">Cluster:</span>
          <span className="font-mono text-slate-200 text-[11px] truncate max-w-[200px] sm:max-w-[240px]">
            mywab.a5y67pc.mongodb.net
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-400 shrink-0">Connection URI:</span>
          <span className="font-mono text-slate-400 text-[11px] truncate max-w-[200px] sm:max-w-[240px]">
            {uriDisplay}
          </span>
        </div>
      </div>

      {/* Real Database Table Stats */}
      <div className="pt-2 border-t border-slate-800/60">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">Live Collection Counts</span>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/40">
            <div className="text-base font-extrabold text-white">{stats?.faqsCount ?? 0}</div>
            <div className="text-[10px] text-slate-400">faqs</div>
          </div>
          <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/40">
            <div className="text-base font-extrabold text-white">{stats?.ordersCount ?? 0}</div>
            <div className="text-[10px] text-slate-400">orders</div>
          </div>
          <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/40">
            <div className="text-base font-extrabold text-white">{stats?.workersCount ?? 0}</div>
            <div className="text-[10px] text-slate-400">workers</div>
          </div>
          <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/40">
            <div className="text-base font-extrabold text-white">{stats?.conversationsCount ?? 0}</div>
            <div className="text-[10px] text-slate-400">conversations</div>
          </div>
        </div>
      </div>
    </div>
  );
};
