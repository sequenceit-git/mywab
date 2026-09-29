'use client';

import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  PlusCircle,
  Zap,
  Package,
  Edit3,
  Trash2,
  GripVertical
} from 'lucide-react';
import { CategoryIcon } from '@/components/BrandIcons';
import { CategoryInfo, PricingProduct } from '../types';
import { KokosStockCheck } from './KokosStockCheck';

interface CategoryAccordionProps {
  cat: CategoryInfo;
  catProducts: PricingProduct[];
  totalCatProducts: number;
  isExpanded: boolean;
  searchQuery: string;
  kokosGlobalDefault: boolean;
  kokosPkgToggling: string | null;
  kokosConfigured: boolean;
  kokosInventory: Record<string, number> | null;
  kokosInvLoading: boolean;
  onCheckKokosInventory: () => void;
  kokosBulkLoading: boolean;
  onBulkSetKokosForCategory: (categoryId: string, enable: boolean) => void;
  pinexAutoFulfill: boolean;
  pinexToggling: boolean;
  onToggleExpand: () => void;
  onTogglePinex: () => void;
  onAddPackage: (catId: string) => void;
  onEditPackage: (product: PricingProduct) => void;
  onDeletePackage: (product: PricingProduct) => void;
  onToggleActive: (product: PricingProduct) => void;
  onToggleKokosForPackage: (product: PricingProduct) => void;
  onReorderPackages: (categoryId: string, orderedIds: string[], persist: boolean) => void;
  canReorder: boolean;
}

export const CategoryAccordion: React.FC<CategoryAccordionProps> = ({
  cat,
  catProducts,
  totalCatProducts,
  isExpanded,
  searchQuery,
  kokosGlobalDefault,
  kokosPkgToggling,
  kokosConfigured,
  kokosInventory,
  kokosInvLoading,
  onCheckKokosInventory,
  kokosBulkLoading,
  onBulkSetKokosForCategory,
  pinexAutoFulfill,
  pinexToggling,
  onToggleExpand,
  onTogglePinex,
  onAddPackage,
  onEditPackage,
  onDeletePackage,
  onToggleActive,
  onToggleKokosForPackage,
  onReorderPackages,
  canReorder
}) => {
  const dragIdRef = React.useRef<string | null>(null);
  const orderRef = React.useRef(catProducts.map((p) => p.id));
  const [draggingId, setDraggingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!draggingId) {
      orderRef.current = catProducts.map((p) => p.id);
    }
  }, [catProducts, draggingId]);

  const moveBefore = (targetId: string) => {
    const fromId = dragIdRef.current;
    if (!fromId || fromId === targetId) return;
    const current = orderRef.current;
    const from = current.indexOf(fromId);
    const to = current.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = [...current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    orderRef.current = next;
    onReorderPackages(cat.id, next, false);
  };

  const startDrag = (id: string, event: React.PointerEvent) => {
    if (!canReorder) return;
    dragIdRef.current = id;
    setDraggingId(id);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const dragOverPoint = (event: React.PointerEvent) => {
    if (!dragIdRef.current) return;
    const el = document.elementFromPoint(event.clientX, event.clientY);
    const target = el?.closest('[data-pkg-id]') as HTMLElement | null;
    const targetId = target?.dataset.pkgId;
    if (targetId) moveBefore(targetId);
  };

  const endDrag = () => {
    if (!dragIdRef.current) return;
    onReorderPackages(cat.id, orderRef.current, true);
    dragIdRef.current = null;
    setDraggingId(null);
  };
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

        {/* Right Controls: Pinex Toggle, Add Package, Chevron */}
        <div className="flex items-center gap-2 self-end sm:self-center" onClick={(e) => e.stopPropagation()}>
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
          {cat.id === 'game_pubg_uid' && (
            <KokosStockCheck
              kokosConfigured={kokosConfigured}
              kokosInventory={kokosInventory}
              kokosInvLoading={kokosInvLoading}
              onCheckInventory={onCheckKokosInventory}
              bulkLoading={kokosBulkLoading}
              onBulkSetAutoFulfill={(enable) => onBulkSetKokosForCategory(cat.id, enable)}
            />
          )}

          {canReorder && catProducts.length > 1 && (
            <p className="text-[10px] text-slate-500">
              Drag the handle to rearrange packages. This order is used on WhatsApp.
            </p>
          )}

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
                      {canReorder && <th className="py-2.5 px-1 w-8"></th>}
                      <th className="py-2.5 px-3">Package Name</th>
                      <th className="py-2.5 px-3">Amount / Credits</th>
                      <th className="py-2.5 px-3">Selling Price (৳)</th>
                      <th className="py-2.5 px-3">Base Cost (৳)</th>
                      <th className="py-2.5 px-3">Net Profit</th>
                      <th className="py-2.5 px-3">Margin</th>
                      <th className="py-2.5 px-3 text-center">Bot Status</th>
                      {cat.id === 'game_pubg_uid' && (
                        <th className="py-2.5 px-3 text-center">Auto-Fulfill (Kokos)</th>
                      )}
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {catProducts.map((p) => {
                      const isActive = p.isActive !== false;

                      return (
                        <tr
                          key={p.id}
                          data-pkg-id={p.id}
                          className={`hover:bg-slate-800/40 transition group ${
                            !isActive ? 'opacity-50' : ''
                          } ${draggingId === p.id ? 'bg-brand-500/10 ring-1 ring-brand-500/30' : ''}`}
                        >
                          {canReorder && (
                            <td className="py-3 px-1 w-8">
                              <button
                                type="button"
                                onPointerDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  startDrag(p.id, e);
                                }}
                                onPointerMove={dragOverPoint}
                                onPointerUp={(e) => {
                                  e.stopPropagation();
                                  endDrag();
                                }}
                                onPointerCancel={endDrag}
                                className="p-1 rounded-md text-slate-500 hover:text-white hover:bg-slate-800 cursor-grab active:cursor-grabbing touch-none"
                                title="Drag to rearrange"
                                aria-label={`Reorder ${p.name}`}
                              >
                                <GripVertical className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                          {/* Name & ID */}
                          <td className="py-3 px-3">
                            <div className="font-bold text-white text-xs flex items-center gap-2 flex-wrap">
                              <span>{p.name}</span>
                              {p.presetAccount?.hasPassword && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/25">
                                  Auto account
                                </span>
                              )}
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
                            {(() => {
                              // For Free Fire: bot is only truly active when package is enabled AND Pinex is ON
                              const botActive = isActive && (cat.id !== 'game_ff' || pinexAutoFulfill);
                              const pinexOffWarning = cat.id === 'game_ff' && isActive && !pinexAutoFulfill;
                              return (
                                <div className="flex flex-col items-center gap-0.5">
                                  <button
                                    onClick={() => onToggleActive(p)}
                                    title={
                                      pinexOffWarning
                                        ? 'Package is enabled but Pinex is OFF — bot cannot fulfill orders'
                                        : isActive
                                        ? 'Active on WhatsApp bot. Click to disable'
                                        : 'Disabled on WhatsApp bot. Click to activate'
                                    }
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 transition ${
                                      botActive
                                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-rose-500/15 hover:text-rose-400 hover:border-rose-500/30'
                                        : pinexOffWarning
                                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                        : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-emerald-500/15 hover:text-emerald-400'
                                    }`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                      botActive ? 'bg-emerald-400' : pinexOffWarning ? 'bg-amber-400' : 'bg-slate-500'
                                    }`}></span>
                                    <span>{botActive ? 'Active' : 'Inactive'}</span>
                                  </button>
                                  {pinexOffWarning && (
                                    <span className="text-[9px] text-amber-500/80">Pinex OFF</span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>

                          {/* Per-Package Kokos Auto-Fulfill Toggle */}
                          {cat.id === 'game_pubg_uid' && (() => {
                            const kokosEffective = p.kokosAutoFulfill !== undefined ? p.kokosAutoFulfill : kokosGlobalDefault;
                            const isTogglingThis = kokosPkgToggling === p.id;
                            return (
                              <td className="py-3 px-3 text-center">
                                <button
                                  onClick={() => onToggleKokosForPackage(p)}
                                  disabled={isTogglingThis}
                                  title={kokosEffective ? 'Kokos auto top-up is ON for this package. Click to turn OFF' : 'Kokos auto top-up is OFF for this package. Click to turn ON'}
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 transition disabled:opacity-50 ${
                                    kokosEffective
                                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-rose-500/15 hover:text-rose-400 hover:border-rose-500/30'
                                      : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-emerald-500/15 hover:text-emerald-400'
                                  }`}
                                >
                                  <Zap className="w-3 h-3 text-amber-400" />
                                  <span>{isTogglingThis ? '...' : kokosEffective ? 'ON' : 'OFF'}</span>
                                </button>
                              </td>
                            );
                          })()}

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
                      data-pkg-id={p.id}
                      className={`p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2.5 ${
                        !isActive ? 'opacity-50' : ''
                      } ${draggingId === p.id ? 'border-brand-500/50 bg-brand-500/5' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        {canReorder && (
                          <button
                            type="button"
                            onPointerDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              startDrag(p.id, e);
                            }}
                            onPointerMove={dragOverPoint}
                            onPointerUp={(e) => {
                              e.stopPropagation();
                              endDrag();
                            }}
                            onPointerCancel={endDrag}
                            className="mt-0.5 p-1 rounded-md text-slate-500 hover:text-white hover:bg-slate-800 cursor-grab active:cursor-grabbing touch-none shrink-0"
                            title="Drag to rearrange"
                            aria-label={`Reorder ${p.name}`}
                          >
                            <GripVertical className="w-4 h-4" />
                          </button>
                        )}
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-white text-xs">{p.name}</h4>
                          <span className="text-[10px] font-mono text-slate-400">
                            Amount: {p.amount || p.name}
                          </span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            (() => {
                              const botActive = isActive && (cat.id !== 'game_ff' || pinexAutoFulfill);
                              const pinexOffWarning = cat.id === 'game_ff' && isActive && !pinexAutoFulfill;
                              return botActive
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : pinexOffWarning
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-400';
                            })()
                          }`}>
                            {(() => {
                              const botActive = isActive && (cat.id !== 'game_ff' || pinexAutoFulfill);
                              const pinexOffWarning = cat.id === 'game_ff' && isActive && !pinexAutoFulfill;
                              return botActive ? 'Active' : pinexOffWarning ? 'Pinex OFF' : 'Inactive';
                            })()}
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

                      {cat.id === 'game_pubg_uid' && (() => {
                        const kokosEffective = p.kokosAutoFulfill !== undefined ? p.kokosAutoFulfill : kokosGlobalDefault;
                        const isTogglingThis = kokosPkgToggling === p.id;
                        return (
                          <button
                            onClick={() => onToggleKokosForPackage(p)}
                            disabled={isTogglingThis}
                            className={`w-full text-[10px] font-bold px-2 py-1.5 rounded-lg inline-flex items-center justify-center gap-1.5 transition disabled:opacity-50 ${
                              kokosEffective
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            <Zap className="w-3 h-3 text-amber-400" />
                            <span>Kokos Auto-Fulfill: {isTogglingThis ? '...' : kokosEffective ? 'ON' : 'OFF'}</span>
                          </button>
                        );
                      })()}

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
