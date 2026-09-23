'use client';

import React from 'react';
import {
  CheckCircle2,
  Zap,
  ToggleLeft,
  ToggleRight,
  Package,
  RefreshCw,
  Search
} from 'lucide-react';
import { PubgUidIcon } from '@/components/BrandIcons';

interface KokosConfigCardProps {
  kokosConfigured: boolean;
  kokosAutoFulfill: boolean;
  kokosToggling: boolean;
  kokosToggleMsg: string | null;
  kokosInventory: Record<string, number> | null;
  kokosInvLoading: boolean;
  kokosLookupUid: string;
  setKokosLookupUid: (val: string) => void;
  kokosLookupLoading: boolean;
  kokosLookupResult: { name?: string; error?: string } | null;
  onToggleKokos: () => void;
  onCheckInventory: () => void;
  onLookupPlayer: (e: React.FormEvent) => void;
}

export const KokosConfigCard: React.FC<KokosConfigCardProps> = ({
  kokosConfigured,
  kokosAutoFulfill,
  kokosToggling,
  kokosToggleMsg,
  kokosInventory,
  kokosInvLoading,
  kokosLookupUid,
  setKokosLookupUid,
  kokosLookupLoading,
  kokosLookupResult,
  onToggleKokos,
  onCheckInventory,
  onLookupPlayer
}) => {
  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-dark-900/90 border border-brand-500/30 space-y-4 shadow-lg relative overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
            <PubgUidIcon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
              <span>Kokos Activator API</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">PUBG UID</span>
            </h4>
            <p className="text-[11px] text-slate-400">Instant UC Code Redemption & Auto-Fulfillment</p>
          </div>
        </div>
        <span
          className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0 ${
            kokosConfigured
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
          }`}
        >
          {kokosConfigured ? 'API Key Configured' : 'Missing KOKOS_API_TOKEN'}
        </span>
      </div>

      {/* Auto-Fulfillment Master Toggle Switch */}
      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-white flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-brand-400" />
            <span>PUBG UID Auto-Fulfill Mode</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {kokosAutoFulfill
              ? '🟢 ON: Orders redeem instantly via Kokos API & notify on WhatsApp'
              : '🔵 OFF: Orders dispatch to Telegram Worker Bot for manual claims'}
          </p>
        </div>

        <button
          onClick={onToggleKokos}
          disabled={kokosToggling}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
            kokosAutoFulfill
              ? 'bg-emerald-500 hover:bg-emerald-400 text-dark-950 shadow-md shadow-emerald-500/20'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
          }`}
        >
          {kokosAutoFulfill ? (
            <>
              <ToggleRight className="w-4 h-4" />
              <span>ON</span>
            </>
          ) : (
            <>
              <ToggleLeft className="w-4 h-4" />
              <span>OFF</span>
            </>
          )}
        </button>
      </div>

      {kokosToggleMsg && (
        <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{kokosToggleMsg}</span>
        </div>
      )}

      {/* Live Kokos Inventory Check */}
      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-300 font-semibold flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-slate-400" />
            <span>Database Code Stock</span>
          </span>
          <button
            onClick={onCheckInventory}
            disabled={kokosInvLoading || !kokosConfigured}
            className="text-[11px] text-brand-400 hover:underline flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${kokosInvLoading ? 'animate-spin' : ''}`} />
            <span>{kokosInventory ? 'Refresh Stock' : 'Check Stock'}</span>
          </button>
        </div>

        {kokosInventory && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1">
            {['60', '325', '660', '1800', '3850', '8100'].map((uc) => (
              <div key={uc} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-center">
                <div className="text-[10px] text-slate-400">{uc} UC</div>
                <div
                  className={`text-xs font-mono font-bold ${
                    (kokosInventory[uc] || 0) > 0 ? 'text-emerald-400' : 'text-slate-500'
                  }`}
                >
                  {kokosInventory[uc] ?? 0}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Test Player Character Lookup */}
      <form onSubmit={onLookupPlayer} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Test Player UID (e.g. 51709255708)"
            value={kokosLookupUid}
            onChange={(e) => setKokosLookupUid(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>
        <button
          type="submit"
          disabled={kokosLookupLoading || !kokosConfigured}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold disabled:opacity-50"
        >
          {kokosLookupLoading ? 'Checking...' : 'Verify'}
        </button>
      </form>

      {kokosLookupResult && (
        <div
          className={`p-2 rounded-xl text-xs flex items-center gap-2 ${
            kokosLookupResult.name
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
              : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
          }`}
        >
          {kokosLookupResult.name ? (
            <span>
              ✅ Player In-Game Name: <b className="font-bold text-white">{kokosLookupResult.name}</b>
            </span>
          ) : (
            <span>❌ {kokosLookupResult.error}</span>
          )}
        </div>
      )}
    </div>
  );
};
