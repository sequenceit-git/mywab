'use client';

import React from 'react';
import { Package, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { CategoryIcon } from '@/components/BrandIcons';
import { CategoryInfo } from '../types';

interface PackageModalProps {
  isOpen: boolean;
  isEditing: boolean;
  categories: CategoryInfo[];
  modalCategoryId: string;
  setModalCategoryId: (val: string) => void;
  modalName: string;
  setModalName: (val: string) => void;
  modalAmount: string;
  setModalAmount: (val: string) => void;
  modalPrice: number;
  setModalPrice: (val: number) => void;
  modalBasePrice: number;
  setModalBasePrice: (val: number) => void;
  modalDescription: string;
  setModalDescription: (val: string) => void;
  modalIsActive: boolean;
  setModalIsActive: (val: boolean) => void;
  modalPkgId: string;
  modalPresetEmail: string;
  setModalPresetEmail: (val: string) => void;
  modalPresetPassword: string;
  setModalPresetPassword: (val: string) => void;
  modalPresetPin: string;
  setModalPresetPin: (val: string) => void;
  modalPresetProfileName: string;
  setModalPresetProfileName: (val: string) => void;
  modalPresetHasPassword: boolean;
  feedbackMsg: { type: 'success' | 'error'; text: string } | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const PackageModal: React.FC<PackageModalProps> = ({
  isOpen,
  isEditing,
  categories,
  modalCategoryId,
  setModalCategoryId,
  modalName,
  setModalName,
  modalAmount,
  setModalAmount,
  modalPrice,
  setModalPrice,
  modalBasePrice,
  setModalBasePrice,
  modalDescription,
  setModalDescription,
  modalIsActive,
  setModalIsActive,
  modalPkgId,
  modalPresetEmail,
  setModalPresetEmail,
  modalPresetPassword,
  setModalPresetPassword,
  modalPresetPin,
  setModalPresetPin,
  modalPresetProfileName,
  setModalPresetProfileName,
  modalPresetHasPassword,
  feedbackMsg,
  isSaving,
  onClose,
  onSubmit
}) => {
  if (!isOpen) return null;

  const liveProfit = modalPrice - modalBasePrice;
  const liveMargin = modalPrice > 0 ? Math.round((liveProfit / modalPrice) * 100) : 0;
  const currentCategory = categories.find((c) => c.id === modalCategoryId);
  const streamingBlob = `${modalPkgId} ${modalName} ${modalCategoryId}`.toLowerCase();
  const isNetflixPkg = streamingBlob.includes('netflix');
  const isCrunchyrollPkg = streamingBlob.includes('crunchyroll');
  const showPresetAccount = isNetflixPkg || isCrunchyrollPkg;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-dark-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <CategoryIcon categoryId={modalCategoryId} className="w-9 h-9" />
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Package className="w-4 h-4 text-brand-400" />
                <span>{isEditing ? 'Edit Package Details' : 'Add New Package'}</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Under Category: <b className="text-slate-200">{currentCategory?.title}</b>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {feedbackMsg && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              feedbackMsg.type === 'error'
                ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
            }`}
          >
            {feedbackMsg.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-3.5 text-xs">
          {/* Category Selector (Only for Add) */}
          {!isEditing && (
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Target Category</label>
              <select
                value={modalCategoryId}
                onChange={(e) => setModalCategoryId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-brand-500 transition"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Package Name */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Package Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={modalName}
              onChange={(e) => setModalName(e.target.value)}
              placeholder="e.g. 60 UC or 115 Diamonds"
              required
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-brand-500 transition text-xs font-semibold"
            />
          </div>

          {/* Amount / Credits */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Amount / Quantity
            </label>
            <input
              type="text"
              value={modalAmount}
              onChange={(e) => setModalAmount(e.target.value)}
              placeholder="e.g. 60, 115, or 1 Month"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-brand-500 transition text-xs"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Used by WhatsApp bot to match customer queries (e.g. typing &quot;60&quot;)
            </span>
          </div>

          {/* Pricing Grid (Selling Price vs Base Cost) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Selling Price (৳) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">৳</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={modalPrice || ''}
                  onChange={(e) => setModalPrice(Number(e.target.value))}
                  placeholder="115"
                  required
                  className="w-full pl-7 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold text-sm focus:outline-none focus:border-brand-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Wholesale Base Cost (৳)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">৳</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={modalBasePrice || ''}
                  onChange={(e) => setModalBasePrice(Number(e.target.value))}
                  placeholder="95"
                  className="w-full pl-7 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-mono text-sm focus:outline-none focus:border-brand-500 transition"
                />
              </div>
            </div>
          </div>

          {/* Dynamic Profit & Margin Preview */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Estimated Net Profit</span>
              <span className="text-base font-black text-emerald-400">+৳{liveProfit}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[11px]">Profit Margin</span>
              <span
                className={`text-base font-black ${
                  liveMargin >= 20 ? 'text-emerald-400' : liveMargin >= 10 ? 'text-indigo-300' : 'text-amber-400'
                }`}
              >
                {liveMargin}%
              </span>
            </div>
          </div>

          {showPresetAccount && (
            <div className="p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/25 space-y-2.5">
              <div>
                <p className="text-xs font-bold text-rose-200">
                  {isNetflixPkg ? '🍿 Netflix auto-delivery account' : '🍥 Crunchyroll auto-delivery account'}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  After payment, these credentials are sent on WhatsApp automatically. Workers only help with Netflix OTP when the customer asks.
                </p>
              </div>
              <input
                type="text"
                value={modalPresetEmail}
                onChange={(e) => setModalPresetEmail(e.target.value)}
                placeholder="Login email"
                autoComplete="off"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs"
              />
              <input
                type="text"
                value={modalPresetPassword}
                onChange={(e) => setModalPresetPassword(e.target.value)}
                placeholder="Password"
                autoComplete="off"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs"
              />
              <input
                type="text"
                value={modalPresetProfileName}
                onChange={(e) => setModalPresetProfileName(e.target.value)}
                placeholder="Profile name (which profile customer should use)"
                autoComplete="off"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs"
              />
              {isNetflixPkg && (
                <input
                  type="text"
                  inputMode="numeric"
                  value={modalPresetPin}
                  onChange={(e) => setModalPresetPin(e.target.value)}
                  placeholder="Profile PIN (optional)"
                  autoComplete="off"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs"
                />
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Description / Note (Optional)
            </label>
            <input
              type="text"
              value={modalDescription}
              onChange={(e) => setModalDescription(e.target.value)}
              placeholder="e.g. Instant UID Top-Up"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-brand-500 transition text-xs"
            />
          </div>

          {/* Active Toggle */}
          {isEditing && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-slate-300 font-semibold">Active in WhatsApp Bot</span>
              <button
                type="button"
                onClick={() => setModalIsActive(!modalIsActive)}
                className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 transition ${
                  modalIsActive
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                <span>{modalIsActive ? 'Enabled 🟢' : 'Disabled ⚪'}</span>
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 text-xs font-black transition flex items-center gap-1.5 shadow-lg shadow-brand-500/20 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : isEditing ? 'Update Package & Sync Bot' : 'Create Package & Sync Bot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
