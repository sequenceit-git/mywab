'use client';

import React from 'react';
import { Bot, Percent, TrendingUp, RotateCcw, PlusCircle } from 'lucide-react';
import { PricingStats } from '../types';

interface PricingStatsRowProps {
  stats: PricingStats | null;
  productCount: number;
  categoryCount: number;
  onAddPackage: () => void;
  onResetDefaults: () => void;
}

export const PricingStatsRow: React.FC<PricingStatsRowProps> = ({
  stats,
  productCount,
  categoryCount,
  onAddPackage,
  onResetDefaults
}) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* WhatsApp Bot Live Sync Status */}
      <div className="p-4 sm:p-5 rounded-2xl bg-dark-900/90 border border-slate-800/80 shadow-md relative overflow-hidden group hover:border-emerald-500/40 transition">
        <div className="flex items-center justify-between">
          <span className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">Bot Integration</span>
          <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
            <Bot className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
        <div className="mt-2 sm:mt-3">
          <div className="text-sm sm:text-base font-bold text-emerald-400 flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Live Synced</span>
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 sm:mt-1">
            WhatsApp bot automatically serves active packages
          </p>
        </div>
      </div>

      {/* Total Catalog Profit Margin */}
      <div className="p-4 sm:p-5 rounded-2xl bg-dark-900/90 border border-slate-800/80 shadow-md relative overflow-hidden group hover:border-indigo-500/40 transition">
        <div className="flex items-center justify-between">
          <span className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg Margin</span>
          <div className="p-1.5 sm:p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
            <Percent className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
        <div className="mt-2 sm:mt-3">
          <div className="text-xl sm:text-2xl font-black text-indigo-300">
            {stats?.avgMarginPercent || 0}%
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 sm:mt-1">
            Across {productCount} active packages
          </p>
        </div>
      </div>

      {/* Avg Profit Per Unit */}
      <div className="p-4 sm:p-5 rounded-2xl bg-dark-900/90 border border-slate-800/80 shadow-md relative overflow-hidden group hover:border-brand-500/40 transition">
        <div className="flex items-center justify-between">
          <span className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg / Unit Profit</span>
          <div className="p-1.5 sm:p-2 rounded-xl bg-brand-500/10 text-brand-400">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
        <div className="mt-2 sm:mt-3">
          <div className="text-xl sm:text-2xl font-black text-brand-400">
            ৳{(stats?.avgProfitPerUnit ?? 0).toLocaleString()}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 sm:mt-1">
            Net profit per item sold
          </p>
        </div>
      </div>

      {/* Categories Count & Add Global */}
      <div className="p-4 sm:p-5 rounded-2xl bg-dark-900/90 border border-slate-800/80 shadow-md flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Categories ({categoryCount})
          </span>
          <button
            onClick={onResetDefaults}
            title="Reset to Factory Defaults"
            className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="mt-2">
          <button
            onClick={onAddPackage}
            className="w-full py-2 px-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-black text-xs transition flex items-center justify-center gap-1.5 shadow-lg shadow-brand-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add New Package</span>
          </button>
        </div>
      </div>
    </div>
  );
};
