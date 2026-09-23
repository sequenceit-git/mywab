'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import { PricingProduct } from '../types';

interface DeleteConfirmModalProps {
  product: PricingProduct | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  product,
  isDeleting,
  onClose,
  onConfirm
}) => {
  if (!product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-dark-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
        <div className="flex items-center gap-3 text-rose-400">
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">Delete Package?</h4>
            <p className="text-[11px] text-slate-400">This action cannot be undone.</p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
          Are you sure you want to remove <b className="text-white">{product.name}</b> (৳{product.price})? It will be removed from the WhatsApp bot catalog immediately.
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
            disabled={isDeleting}
            className="px-3.5 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Confirm Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};
