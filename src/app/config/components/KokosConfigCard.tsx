'use client';

import React from 'react';
import {
  CheckCircle2,
  Search
} from 'lucide-react';
import { PubgUidIcon } from '@/components/BrandIcons';

interface KokosConfigCardProps {
  kokosConfigured: boolean;
  kokosLookupUid: string;
  setKokosLookupUid: (val: string) => void;
  kokosLookupLoading: boolean;
  kokosLookupResult: { name?: string; error?: string } | null;
  onLookupPlayer: (e: React.FormEvent) => void;
}

export const KokosConfigCard: React.FC<KokosConfigCardProps> = ({
  kokosConfigured,
  kokosLookupUid,
  setKokosLookupUid,
  kokosLookupLoading,
  kokosLookupResult,
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

      {/* Auto-Fulfillment & stock check note: both now live on the Pricing page */}
      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 text-[11px] text-slate-400">
        Auto-fulfillment toggle and UC code stock check have moved to <b className="text-slate-200">Pricing → top of the package list</b>.
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
