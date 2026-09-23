'use client';

import React from 'react';
import { Zap } from 'lucide-react';

interface PinexConfigCardProps {
  pinexConfigured: boolean;
  pinexAutoFulfill: boolean;
  pinexToggling: boolean;
  pinexToggleMsg: string | null;
  onTogglePinex: () => void;
}

export const PinexConfigCard: React.FC<PinexConfigCardProps> = ({
  pinexConfigured,
  pinexAutoFulfill,
  pinexToggling,
  pinexToggleMsg,
  onTogglePinex
}) => {
  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-dark-900/90 border border-slate-800/80 space-y-4 shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">Pinex API (Free Fire Auto-Fulfillment)</h4>
            <p className="text-[11px] text-slate-400">Direct Free Fire Diamonds & Shells Redemption</p>
          </div>
        </div>
        <span
          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${
            pinexConfigured
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}
        >
          {pinexConfigured ? 'Connected' : 'Key Missing in .env'}
        </span>
      </div>

      {/* Pinex Auto-Fulfill Switch */}
      <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/60 flex items-center justify-between gap-3">
        <div>
          <span className="font-bold text-white text-xs block">Free Fire Auto-Fulfillment</span>
          <span className="text-[11px] text-slate-400">
            {pinexAutoFulfill
              ? 'Orders are automatically fulfilled via Pinex API without Telegram'
              : 'Auto-fulfillment is paused'}
          </span>
        </div>
        <button
          onClick={onTogglePinex}
          disabled={pinexToggling || !pinexConfigured}
          className={`py-1.5 px-3 rounded-xl font-bold text-xs transition flex items-center gap-1.5 shrink-0 ${
            pinexAutoFulfill
              ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          } disabled:opacity-50`}
        >
          {pinexToggling ? (
            <span>Saving...</span>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5" />
              <span>{pinexAutoFulfill ? 'Active (ON)' : 'Disabled (OFF)'}</span>
            </>
          )}
        </button>
      </div>

      {pinexToggleMsg && (
        <div className="p-2 rounded-xl text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300">
          {pinexToggleMsg}
        </div>
      )}

      <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/60 space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Pinex Endpoint:</span>
          <span className="font-mono text-slate-300 text-[11px]">https://sohan.pinexbot.shop/pinex/brand</span>
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="text-slate-400">Callback Gateway:</span>
          <span className="font-mono text-slate-400 text-[11px]">/api/system/pinex/callback</span>
        </div>
      </div>
    </div>
  );
};
