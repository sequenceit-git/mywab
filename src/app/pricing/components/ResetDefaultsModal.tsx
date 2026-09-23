'use client';

import React from 'react';
import { RotateCcw } from 'lucide-react';

interface ResetDefaultsModalProps {
  isOpen: boolean;
  isResetting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ResetDefaultsModal: React.FC<ResetDefaultsModalProps> = ({
  isOpen,
  isResetting,
  onClose,
  onConfirm
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-dark-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
        <div className="flex items-center gap-3 text-amber-400">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 shrink-0">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">Reset to Factory Catalog?</h4>
            <p className="text-[11px] text-slate-400">Restore all standard game packages</p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
          This will restore all default packages and standard prices across all 8 game categories. Any custom packages will be reset.
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isResetting}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition disabled:opacity-50"
          >
            {isResetting ? 'Resetting...' : 'Confirm Reset'}
          </button>
        </div>
      </div>
    </div>
  );
};
