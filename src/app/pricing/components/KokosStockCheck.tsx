'use client';

import React from 'react';
import { Package, RefreshCw, Zap } from 'lucide-react';

interface KokosStockCheckProps {
  kokosConfigured: boolean;
  kokosInventory: Record<string, number> | null;
  kokosInvLoading: boolean;
  onCheckInventory: () => void;
  onBulkSetAutoFulfill: (enable: boolean) => void;
  bulkLoading?: boolean;
}

const UC_DENOMINATIONS = ['60', '325', '660', '1800', '3850', '8100'];

export const KokosStockCheck: React.FC<KokosStockCheckProps> = ({
  kokosConfigured,
  kokosInventory,
  kokosInvLoading,
  onCheckInventory,
  onBulkSetAutoFulfill,
  bulkLoading
}) => {
  return (
    <div className="p-3.5 rounded-2xl bg-dark-900/90 border border-amber-500/25 shadow-sm space-y-2.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-bold text-white">Kokos UC Code Stock</h4>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                  kokosConfigured
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}
              >
                {kokosConfigured ? 'API Configured' : 'Not Configured'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Check live PUBG UC code stock before enabling auto-fulfill on a package.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center">
          {/* Bulk Auto-Fulfill ON/OFF for all packages in this category */}
          <div className="flex items-center rounded-xl border border-slate-700 overflow-hidden">
            <button
              onClick={() => onBulkSetAutoFulfill(true)}
              disabled={bulkLoading}
              title="Turn Kokos auto-fulfill ON for every package in this category"
              className="px-2.5 py-1.5 text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 transition disabled:opacity-50"
            >
              ON for All
            </button>
            <button
              onClick={() => onBulkSetAutoFulfill(false)}
              disabled={bulkLoading}
              title="Turn Kokos auto-fulfill OFF for every package in this category"
              className="px-2.5 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border-l border-slate-700 transition disabled:opacity-50"
            >
              OFF for All
            </button>
          </div>

          <button
            onClick={onCheckInventory}
            disabled={kokosInvLoading || !kokosConfigured}
            className="py-1.5 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${kokosInvLoading ? 'animate-spin' : ''}`} />
            <span>{kokosInventory ? 'Refresh Stock' : 'Check Stock'}</span>
          </button>
        </div>
      </div>

      {kokosInventory && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1 border-t border-slate-800/60">
          {UC_DENOMINATIONS.map((uc) => (
            <div key={uc} className="p-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-center mt-2.5">
              <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                <Package className="w-2.5 h-2.5" />
                <span>{uc} UC</span>
              </div>
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
  );
};
