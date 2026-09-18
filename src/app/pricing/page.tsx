'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import {
  BadgePercent,
  Search,
  DollarSign,
  TrendingUp,
  Percent,
  Edit3,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
  Package,
  Layers,
  ArrowUpDown,
  Check,
  X,
  PlusCircle,
  HelpCircle
} from 'lucide-react';

interface PricingProduct {
  id: string;
  categoryId: string;
  categoryTitle: string;
  categoryEmoji: string;
  name: string;
  price: number;
  basePrice: number;
  profit: number;
  marginPercent: number;
  description?: string;
  updatedAt?: string;
}

interface PricingStats {
  totalProducts: number;
  totalPotentialRevenue: number;
  totalBaseCost: number;
  totalProfit: number;
  avgMarginPercent: number;
  avgProfitPerUnit: number;
}

export default function PricingPage() {
  const [products, setProducts] = useState<PricingProduct[]>([]);
  const [stats, setStats] = useState<PricingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Edit Modal State
  const [editingProduct, setEditingProduct] = useState<PricingProduct | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editBasePrice, setEditBasePrice] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Reset Modal State
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const fetchPricing = async () => {
    try {
      const res = await fetch('/api/pricing');
      const data = await res.json();
      if (data.success) {
        setProducts(data.products || []);
        setStats(data.stats || null);
      }
    } catch (err) {
      console.error('Failed to fetch pricing catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPricing();
  }, []);

  // Category options for tabs
  const categories = Array.from(
    new Set(products.map(p => JSON.stringify({ id: p.categoryId, title: p.categoryTitle, emoji: p.categoryEmoji })))
  ).map(str => JSON.parse(str));

  // Filtered products
  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'ALL' || p.categoryId === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      p.name.toLowerCase().includes(q) ||
      p.categoryTitle.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  const handleOpenEdit = (product: PricingProduct) => {
    setEditingProduct(product);
    setEditPrice(product.price);
    setEditBasePrice(product.basePrice);
    setFeedbackMsg(null);
  };

  const handleSavePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    if (editPrice < 0 || editBasePrice < 0) {
      setFeedbackMsg({ type: 'error', text: 'Prices cannot be negative numbers' });
      return;
    }

    setIsSaving(true);
    setFeedbackMsg(null);

    try {
      const res = await fetch('/api/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingProduct.id,
          price: Number(editPrice),
          basePrice: Number(editBasePrice)
        })
      });

      const data = await res.json();
      if (data.success) {
        setEditingProduct(null);
        await fetchPricing();
      } else {
        setFeedbackMsg({ type: 'error', text: data.error || 'Failed to update price' });
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: 'Network error while updating price' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefaults = async () => {
    setIsResetting(true);
    try {
      const res = await fetch('/api/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' })
      });
      const data = await res.json();
      if (data.success) {
        setShowResetModal(false);
        await fetchPricing();
      }
    } catch (err) {
      console.error('Reset error:', err);
    } finally {
      setIsResetting(false);
    }
  };

  // Live calculator for modal
  const liveProfit = Math.max(0, editPrice - editBasePrice);
  const liveMargin = editPrice > 0 ? Math.round((liveProfit / editPrice) * 100) : 0;

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-950">
      <Header
        title="Pricing & Profit Management"
        subtitle="Configure selling prices, base wholesale costs, and monitor profit margins across all catalog packages"
      />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Top 4 KPI Metrics Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Average Profit Margin */}
          <div className="p-5 rounded-2xl bg-dark-900/90 border border-slate-800/80 shadow-md relative overflow-hidden group hover:border-emerald-500/40 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg Catalog Margin</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <Percent className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-emerald-400">
                {stats?.avgMarginPercent || 0}%
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Average gross margin across all packages
              </p>
            </div>
          </div>

          {/* Average Profit Per Unit */}
          <div className="p-5 rounded-2xl bg-dark-900/90 border border-slate-800/80 shadow-md relative overflow-hidden group hover:border-brand-500/40 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg Profit / Unit</span>
              <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-brand-400">
                ৳{stats?.avgProfitPerUnit || 0}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Average net profit earned per item sale
              </p>
            </div>
          </div>

          {/* Total Active Packages */}
          <div className="p-5 rounded-2xl bg-dark-900/90 border border-slate-800/80 shadow-md relative overflow-hidden group hover:border-sky-500/40 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Packages</span>
              <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
                <Package className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-white">
                {stats?.totalProducts || 0}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Configured across {categories.length} game/service categories
              </p>
            </div>
          </div>

          {/* Reset / Actions Card */}
          <div className="p-5 rounded-2xl bg-dark-900/90 border border-slate-800/80 shadow-md flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Catalog Controls</span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                <RotateCcw className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2">
              <button
                onClick={() => setShowResetModal(true)}
                className="w-full py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/90 border border-slate-700/60 text-xs font-bold text-slate-200 hover:text-white transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Default Prices</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter, Search & Category Navigation */}
        <div className="space-y-3 p-4 rounded-2xl bg-dark-900/90 border border-slate-800/80 shadow-lg">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search packages, games, UC, diamonds, subscriptions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500/50"
              />
            </div>

            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span>Showing: <b className="text-white">{filteredProducts.length}</b> of {products.length} packages</span>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 border-t border-slate-800/60">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                selectedCategory === 'ALL'
                  ? 'bg-brand-500 text-dark-950 shadow-sm'
                  : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              🌐 All Categories ({products.length})
            </button>

            {categories.map((cat: any) => {
              const isSelected = selectedCategory === cat.id;
              const count = products.filter(p => p.categoryId === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-brand-500 text-dark-950 shadow-sm'
                      : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.title} ({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Pricing & Profit Table */}
        <div className="bg-dark-900/90 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-950/60">
                  <th className="py-3.5 px-4">Game / Category</th>
                  <th className="py-3.5 px-4">Package Name</th>
                  <th className="py-3.5 px-4 text-right">Cost / Base Price</th>
                  <th className="py-3.5 px-4 text-right">Selling Price</th>
                  <th className="py-3.5 px-4 text-right">Unit Profit</th>
                  <th className="py-3.5 px-4 text-center">Profit Margin</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      Loading pricing catalog...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      No packages match your search or filter.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((pkg) => {
                    const isHighMargin = pkg.marginPercent >= 20;
                    const isMedMargin = pkg.marginPercent >= 10 && pkg.marginPercent < 20;

                    return (
                      <tr key={pkg.id} className="hover:bg-slate-800/30 transition group">
                        {/* Category */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{pkg.categoryEmoji}</span>
                            <div>
                              <div className="font-semibold text-white">{pkg.categoryTitle}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{pkg.categoryId}</div>
                            </div>
                          </div>
                        </td>

                        {/* Package */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-200">{pkg.name}</div>
                          {pkg.description && (
                            <div className="text-[10px] text-slate-400">{pkg.description}</div>
                          )}
                        </td>

                        {/* Base / Cost Price */}
                        <td className="py-3 px-4 text-right font-mono text-slate-400">
                          ৳{pkg.basePrice}
                        </td>

                        {/* Selling Price */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-brand-400">
                          ৳{pkg.price}
                        </td>

                        {/* Unit Profit */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                          +৳{pkg.profit}
                        </td>

                        {/* Margin Badge */}
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                              isHighMargin
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : isMedMargin
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            }`}
                          >
                            {pkg.marginPercent}%
                          </span>
                        </td>

                        {/* Action Button */}
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleOpenEdit(pkg)}
                            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-brand-500 hover:text-dark-950 text-slate-300 text-xs font-semibold transition flex items-center gap-1.5 mx-auto shadow-sm"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit Price</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Edit Price Modal */}
        {editingProduct && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-dark-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2 text-brand-400">
                  <Edit3 className="w-5 h-5" />
                  <h3 className="text-sm font-bold text-white">Edit Package Pricing & Base Cost</h3>
                </div>
                <button
                  onClick={() => setEditingProduct(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                <div className="text-slate-400">
                  Category: <b className="text-white">{editingProduct.categoryEmoji} {editingProduct.categoryTitle}</b>
                </div>
                <div className="text-slate-400">
                  Package: <b className="text-brand-400">{editingProduct.name}</b>
                </div>
              </div>

              {feedbackMsg && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    feedbackMsg.type === 'success'
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                      : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                  }`}
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{feedbackMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleSavePrice} className="space-y-4 text-xs">
                {/* Inputs Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Base / Cost Price (৳)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={editBasePrice}
                      onChange={(e) => setEditBasePrice(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-brand-500/50"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">Wholesale purchase cost</span>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Selling Price (৳)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={editPrice}
                      onChange={(e) => setEditPrice(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-brand-500/50"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">Price charged to customer</span>
                  </div>
                </div>

                {/* Real-time Profit Preview Card */}
                <div className="p-3.5 rounded-xl bg-slate-950/90 border border-brand-500/30 grid grid-cols-2 gap-2 text-center">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Unit Net Profit</div>
                    <div className="text-lg font-black text-emerald-400 font-mono mt-0.5">
                      +৳{liveProfit}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Profit Margin</div>
                    <div className="text-lg font-black text-brand-400 font-mono mt-0.5">
                      {liveMargin}%
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-950 font-bold text-xs transition disabled:opacity-50 shadow-sm"
                  >
                    {isSaving ? 'Saving...' : 'Save Pricing'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reset Confirmation Modal */}
        {showResetModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-dark-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
              <div className="flex items-center gap-2 text-amber-400">
                <RotateCcw className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white">Reset Catalog to Factory Defaults</h3>
              </div>
              <p className="text-xs text-slate-400">
                Are you sure you want to reset all custom package selling prices and base costs back to their initial factory defaults?
              </p>
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
                <button
                  onClick={() => setShowResetModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetToDefaults}
                  disabled={isResetting}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white transition disabled:opacity-50"
                >
                  {isResetting ? 'Resetting...' : 'Confirm Reset'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
