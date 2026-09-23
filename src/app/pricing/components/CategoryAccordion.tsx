'use client';

import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  PlusCircle,
  Zap,
  Package,
  Edit3,
  Trash2
} from 'lucide-react';
import { CategoryIcon } from '@/components/BrandIcons';
import { CategoryInfo, PricingProduct } from '../types';

interface CategoryAccordionProps {
  cat: CategoryInfo;
  catProducts: PricingProduct[];
  totalCatProducts: number;
  isExpanded: boolean;
  searchQuery: string;
  kokosAutoFulfill: boolean;
  kokosToggling: boolean;
  pinexAutoFulfill: boolean;
  pinexToggling: boolean;
  onToggleExpand: () => void;
  onToggleKokos: () => void;
  onTogglePinex: () => void;
  onAddPackage: (catId: string) => void;
  onEditPackage: (product: PricingProduct) => void;
  onDeletePackage: (product: PricingProduct) => void;
  onToggleActive: (product: PricingProduct) => void;
}

export const CategoryAccordion: React.FC<CategoryAccordionProps> = ({
  cat,
  catProducts,
  totalCatProducts,
  isExpanded,
  searchQuery,
  kokosAutoFulfill,
  kokosToggling,
  pinexAutoFulfill,
  pinexToggling,
  onToggleExpand,
  onToggleKokos,
  onTogglePinex,
  onAddPackage,
  onEditPackage,
  onDeletePackage,
  onToggleActive
}) => {
  return (
    <div
      className={`rounded-2xl border transition overflow-hidden shadow-md ${
        isExpanded
          ? 'bg-dark-900/95 border-slate-700/90 ring-1 ring-brand-500/20 shadow-brand-500/5'
          : 'bg-dark-900/80 border-slate-800/80 hover:border-slate-700/90'
      }`}
    >
      {/* Category Header Row (Click to Expand/Collapse) */}
      <div
        onClick={onToggleExpand}
        className="p-3 sm:p-3.5 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 select-none hover:bg-slate-800/30 transition group"
      >
        {/* Left: Icon, Category Name, Meta */}
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-xl bg-slate-900/90 border border-slate-700/60 shadow-sm shrink-0 flex items-center justify-center group-hover:scale-105 transition">
            <CategoryIcon categoryId={cat.id} className="w-6 h-6 sm:w-7 sm:h-7 shrink-0 drop-shadow" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-brand-300 transition">
                {cat.title || cat.fullName}
              </h3>
              <span className="text-[9px] sm:text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {catProducts.length}
                {searchQuery && catProducts.length !== totalCatProducts ? ` of ${totalCatProducts}` : ''} packages
              </span>
              <span className="text-[9px] sm:text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-950/80 text-slate-400 border border-slate-800">
                {cat.requiresUid ? 'Player UID' : 'Login / Info'}
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">
              {cat.requiresUid ? 'Instant Player UID recharge' : 'Account login / credentials required'}
            </p>
          </div>
        </div>

        {/* Right Controls: Kokos Toggle, Pinex Toggle, Add Package, Chevron */}
        <div className="flex items-center gap-2 self-end sm:self-center" onClick={(e) => e.stopPropagation()}>
          {/* PUBG UID Kokos Toggle */}
          {cat.id === 'game_pubg_uid' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleKokos();
              }}
              disabled={kokosToggling}
              title="Toggle Kokos API PUBG Auto-Fulfillment"
              className={`text-[10px] font-bold px-2.5 py-1.5 rounded-xl inline-flex items-center gap-1.5 transition ${
                kokosAutoFulfill
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Kokos: {kokosAutoFulfill ? 'ON' : 'OFF'}</span>
            </button>
          )}

          {/* Free Fire Pinex Toggle */}
          {cat.id === 'game_ff' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePinex();
              }}
              disabled={pinexToggling}
              title="Toggle Pinex Free Fire Auto-Fulfillment"
              className={`text-[10px] font-bold px-2.5 py-1.5 rounded-xl inline-flex items-center gap-1.5 transition ${
                pinexAutoFulfill
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Pinex Auto: {pinexAutoFulfill ? 'ON' : 'OFF'}</span>
            </button>
          )}

          {/* Add Package to this Category */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddPackage(cat.id);
            }}
            className="py-1.5 px-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-black text-xs transition flex items-center gap-1.5 shadow-md shadow-brand-500/15"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Add Package</span>
          </button>

          {/* Chevron Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title={isExpanded ? 'Collapse Category' : 'Expand Category'}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-brand-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>
        </div>
      </div>

      {/* Expandable Package Container */}
      {isExpanded && (
        <div className="border-t border-slate-800/80 p-4 sm:p-5 bg-slate-950/40 space-y-3">
          {catProducts.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs space-y-2">
              <Package className="w-7 h-7 text-slate-600 mx-auto opacity-50" />
              <p>
                {searchQuery
                  ? `No packages found in ${cat.title} matching "${searchQuery}".`
                  : `No packages added under ${cat.title} yet.`}
              </p>
              <button
                onClick={() => onAddPackage(cat.id)}
                className="text-brand-400 hover:underline font-semibold"
              >
                + Add the first package for {cat.title}
              </button>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead>
                    <tr className="border-b border-slate-800/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-2.5 px-3">Package Name</th>
                      <th className="py-2.5 px-3">Amount / Credits</th>
                      <th className="py-2.5 px-3">Selling Price (৳)</th>
                      <th className="py-2.5 px-3">Base Cost (৳)</th>
                      <th className="py-2.5 px-3">Net Profit</th>
                      <th className="py-2.5 px-3">Margin</th>
                      <th className="py-2.5 px-3 text-center">Bot Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {catProducts.map((p) => {
                      const isActive = p.isActive !== false;

                      return (
                        <tr
                          key={p.id}
                          className={`hover:bg-slate-800/40 transition group ${
                            !isActive ? 'opacity-50' : ''
                          }`}
                        >
                          {/* Name & ID */}
                          <td className="py-3 px-3">
                            <div className="font-bold text-white text-xs flex items-center gap-2">
                              <span>{p.name}</span>
                              {p.description && (
                                <span className="text-[10px] text-slate-500 font-normal truncate max-w-[160px]" title={p.description}>
                                  ({p.description})
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-slate-500 block">
                              {p.id}
                            </span>
                          </td>

                          {/* Amount */}
                          <td className="py-3 px-3">
                            <span className="font-mono text-slate-200 font-semibold px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/60">
                              {p.amount || p.name}
                            </span>
                          </td>

                          {/* Selling Price */}
                          <td className="py-3 px-3 font-bold text-white text-sm">
                            ৳{p.price}
                          </td>

                          {/* Base Cost */}
                          <td className="py-3 px-3 font-mono text-slate-400">
                            ৳{p.basePrice}
                          </td>

                          {/* Net Profit */}
                          <td className="py-3 px-3 font-bold text-emerald-400">
                            +৳{p.profit}
                          </td>

                          {/* Margin % */}
                          <td className="py-3 px-3">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              p.marginPercent >= 20
                                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                                : p.marginPercent >= 10
                                ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                                : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                            }`}>
                              {p.marginPercent}%
                            </span>
                          </td>

                          {/* Bot Status Toggle */}
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={() => onToggleActive(p)}
                              title={isActive ? 'Active on WhatsApp bot. Click to disable' : 'Disabled on WhatsApp bot. Click to activate'}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 transition ${
                                isActive
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-rose-500/15 hover:text-rose-400 hover:border-rose-500/30'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-emerald-500/15 hover:text-emerald-400'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
                              <span>{isActive ? 'Active' : 'Disabled'}</span>
                            </button>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => onEditPackage(p)}
                                title="Edit Package"
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onDeletePackage(p)}
                                title="Delete Package"
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="md:hidden space-y-2.5">
                {catProducts.map((p) => {
                  const isActive = p.isActive !== false;

                  return (
                    <div
                      key={p.id}
                      className={`p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2.5 ${
                        !isActive ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-white text-xs">{p.name}</h4>
                          <span className="text-[10px] font-mono text-slate-400">
                            Amount: {p.amount || p.name}
                          </span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {isActive ? 'Bot Active' : 'Disabled'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 p-2 rounded-lg bg-slate-900/60 border border-slate-800/50 text-center">
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase block">Price</span>
                          <span className="text-xs font-bold text-white">৳{p.price}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase block">Cost</span>
                          <span className="text-xs font-mono text-slate-300">৳{p.basePrice}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 uppercase block">Profit</span>
                          <span className="text-xs font-bold text-emerald-400">+{p.marginPercent}%</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/50">
                        <button
                          onClick={() => onToggleActive(p)}
                          className="text-[11px] text-slate-400 hover:text-slate-200"
                        >
                          {isActive ? 'Disable in Bot' : 'Enable in Bot'}
                        </button>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onEditPackage(p)}
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs font-semibold px-2.5 flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => onDeletePackage(p)}
                            className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
