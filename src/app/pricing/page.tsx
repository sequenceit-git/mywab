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
  Trash2,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  Bot,
  Zap,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { CategoryIcon } from '@/components/BrandIcons';

interface PricingProduct {
  id: string;
  categoryId: string;
  categoryTitle: string;
  categoryEmoji?: string;
  name: string;
  amount: string;
  price: number;
  basePrice: number;
  profit: number;
  marginPercent: number;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
  updatedAt?: string;
}

interface CategoryInfo {
  id: string;
  code: string;
  title: string;
  fullName: string;
  emoji: string;
  requiresUid: boolean;
  inputPrompt: string;
  inputLabel: string;
  packages: any[];
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
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [stats, setStats] = useState<PricingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Expanded Categories State (Set of category IDs) - default all collapsed
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Package Modal State (Add or Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [modalPkgId, setModalPkgId] = useState<string>('');
  const [modalCategoryId, setModalCategoryId] = useState<string>('game_pubg_uid');
  const [modalName, setModalName] = useState<string>('');
  const [modalAmount, setModalAmount] = useState<string>('');
  const [modalPrice, setModalPrice] = useState<number>(0);
  const [modalBasePrice, setModalBasePrice] = useState<number>(0);
  const [modalDescription, setModalDescription] = useState<string>('');
  const [modalIsActive, setModalIsActive] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Delete Modal State
  const [deletingProduct, setDeletingProduct] = useState<PricingProduct | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset Modal State
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Kokos Auto-Fulfill Status
  const [kokosAutoFulfill, setKokosAutoFulfill] = useState<boolean>(false);
  const [kokosToggling, setKokosToggling] = useState<boolean>(false);

  // Pinex Free Fire Auto-Fulfill Status
  const [pinexAutoFulfill, setPinexAutoFulfill] = useState<boolean>(true);
  const [pinexToggling, setPinexToggling] = useState<boolean>(false);

  const fetchKokosStatus = async () => {
    try {
      const res = await fetch('/api/system/kokos');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setKokosAutoFulfill(data.autoFulfillEnabled);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPinexStatus = async () => {
    try {
      const res = await fetch('/api/system/pinex');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setPinexAutoFulfill(data.autoFulfillEnabled);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleKokos = async () => {
    setKokosToggling(true);
    try {
      const nextState = !kokosAutoFulfill;
      const res = await fetch('/api/system/kokos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TOGGLE_AUTO_FULFILL',
          enabled: nextState
        })
      });
      const data = await res.json();
      if (data.success) {
        setKokosAutoFulfill(data.autoFulfillEnabled);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setKokosToggling(false);
    }
  };

  const handleTogglePinex = async () => {
    setPinexToggling(true);
    try {
      const nextState = !pinexAutoFulfill;
      const res = await fetch('/api/system/pinex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TOGGLE_AUTO_FULFILL',
          enabled: nextState
        })
      });
      const data = await res.json();
      if (data.success) {
        setPinexAutoFulfill(data.autoFulfillEnabled);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPinexToggling(false);
    }
  };

  const fetchPricing = async () => {
    try {
      const res = await fetch('/api/pricing?all=true');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setProducts(data.products || []);
          setCategories(data.categories || []);
          setStats(data.stats || null);
        }
      }
      await fetchKokosStatus();
      await fetchPinexStatus();
    } catch (err) {
      console.error('Failed to fetch pricing catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPricing();
  }, []);

  // Accordion toggle helpers
  const toggleCategory = (catId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedCategories(new Set(categories.map((c) => c.id)));
  };

  const collapseAll = () => {
    setExpandedCategories(new Set());
  };

  // Open modal for Creating new package
  const handleOpenAdd = (catId?: string) => {
    const targetCat = catId || categories[0]?.id || 'game_pubg_uid';
    setIsEditing(false);
    setModalPkgId('');
    setModalCategoryId(targetCat);
    setModalName('');
    setModalAmount('');
    setModalPrice(0);
    setModalBasePrice(0);
    setModalDescription('');
    setModalIsActive(true);
    setFeedbackMsg(null);
    setIsModalOpen(true);
  };

  // Open modal for Editing existing package
  const handleOpenEdit = (product: PricingProduct) => {
    setIsEditing(true);
    setModalPkgId(product.id);
    setModalCategoryId(product.categoryId);
    setModalName(product.name);
    setModalAmount(product.amount || product.name);
    setModalPrice(product.price);
    setModalBasePrice(product.basePrice);
    setModalDescription(product.description || '');
    setModalIsActive(product.isActive !== false);
    setFeedbackMsg(null);
    setIsModalOpen(true);
  };

  // Save package (Create or Update)
  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!modalName.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Package Name is required' });
      return;
    }
    if (modalPrice < 0 || modalBasePrice < 0) {
      setFeedbackMsg({ type: 'error', text: 'Prices cannot be negative numbers' });
      return;
    }

    setIsSaving(true);
    setFeedbackMsg(null);

    try {
      if (isEditing) {
        // Update existing package
        const res = await fetch('/api/pricing', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: modalPkgId,
            name: modalName.trim(),
            amount: modalAmount.trim() || modalName.trim(),
            price: Number(modalPrice),
            basePrice: Number(modalBasePrice),
            description: modalDescription.trim(),
            isActive: modalIsActive
          })
        });

        const data = await res.json();
        if (data.success) {
          setIsModalOpen(false);
          await fetchPricing();
        } else {
          setFeedbackMsg({ type: 'error', text: data.error || 'Failed to update package' });
        }
      } else {
        // Create new package
        const res = await fetch('/api/pricing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            categoryId: modalCategoryId,
            name: modalName.trim(),
            amount: modalAmount.trim() || modalName.trim(),
            price: Number(modalPrice),
            basePrice: Number(modalBasePrice),
            description: modalDescription.trim()
          })
        });

        const data = await res.json();
        if (data.success) {
          setIsModalOpen(false);
          // Auto-expand category so the user sees their new package immediately
          setExpandedCategories((prev) => new Set([...Array.from(prev), modalCategoryId]));
          await fetchPricing();
        } else {
          setFeedbackMsg({ type: 'error', text: data.error || 'Failed to create package' });
        }
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: 'Network error while saving package' });
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle package active status directly from table
  const handleToggleActive = async (product: PricingProduct) => {
    try {
      const nextState = product.isActive === false;
      await fetch('/api/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: product.id,
          isActive: nextState
        })
      });
      await fetchPricing();
    } catch (err) {
      console.error('Failed to toggle package status:', err);
    }
  };

  // Delete package
  const handleDeletePackage = async () => {
    if (!deletingProduct) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/pricing?id=${encodeURIComponent(deletingProduct.id)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setDeletingProduct(null);
        await fetchPricing();
      }
    } catch (err) {
      console.error('Failed to delete package:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Reset to Defaults
  const handleResetDefaults = async () => {
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
      console.error('Failed to reset pricing defaults:', err);
    } finally {
      setIsResetting(false);
    }
  };

  // Live calculator for modal
  const liveProfit = Math.max(0, modalPrice - modalBasePrice);
  const liveMargin = modalPrice > 0 ? Math.round((liveProfit / modalPrice) * 100) : 0;

  // Search filter helper across categories & packages
  const query = searchQuery.toLowerCase().trim();
  const getCategoryProducts = (catId: string) => {
    return products.filter((p) => {
      if (p.categoryId !== catId) return false;
      if (!query) return true;
      return (
        p.name.toLowerCase().includes(query) ||
        (p.amount && p.amount.toLowerCase().includes(query)) ||
        p.categoryTitle.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query))
      );
    });
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-950">
      <Header
        title="Game Categories & Package Management"
        subtitle="Manage game categories, configure package pricing, wholesale base costs, and synchronize real-time catalog changes with the WhatsApp Bot"
      />

      <main className="p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-4 sm:space-y-6 pb-20 lg:pb-6">
        {/* Top Status & KPI Row */}
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
                Across {products.length} active packages
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
                Categories ({categories.length})
              </span>
              <button
                onClick={() => setShowResetModal(true)}
                title="Reset to Factory Defaults"
                className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="mt-2">
              <button
                onClick={() => handleOpenAdd()}
                className="w-full py-2 px-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-black text-xs transition flex items-center justify-center gap-1.5 shadow-lg shadow-brand-500/20"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Add New Package</span>
              </button>
            </div>
          </div>
        </div>

        {/* Global Toolbar / Search & Expand Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-dark-900/90 border border-slate-800/80 shadow-sm">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search packages across all categories (e.g. 60 UC, Weekly, Diamond)..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-brand-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <span className="text-[11px] text-slate-500 hidden md:inline">
              {categories.length} Game & Service Categories
            </span>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={expandAll}
              className="py-1.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition flex items-center gap-1.5 border border-slate-700/60"
            >
              <span>Expand All</span>
            </button>
            <button
              onClick={collapseAll}
              className="py-1.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition flex items-center gap-1.5 border border-slate-700/60"
            >
              <span>Collapse All</span>
            </button>
          </div>
        </div>

        {/* Expandable Category Accordion List */}
        {loading ? (
          <div className="py-20 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
            <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
            <span>Loading categories and packages from catalog...</span>
          </div>
        ) : (
          <div className="space-y-3.5">
            {categories.map((cat) => {
              const catProducts = getCategoryProducts(cat.id);
              const totalCatProducts = products.filter((p) => p.categoryId === cat.id).length;
              // If user is searching and category has matching items, force expand
              const isExpanded = query ? catProducts.length > 0 : expandedCategories.has(cat.id);

              return (
                <div
                  key={cat.id}
                  className={`rounded-2xl border transition overflow-hidden shadow-md ${
                    isExpanded
                      ? 'bg-dark-900/95 border-slate-700/90 ring-1 ring-brand-500/20 shadow-brand-500/5'
                      : 'bg-dark-900/80 border-slate-800/80 hover:border-slate-700/90'
                  }`}
                >
                  {/* Category Header Row (Click to Expand/Collapse) */}
                  <div
                    onClick={() => toggleCategory(cat.id)}
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
                            {catProducts.length}{query && catProducts.length !== totalCatProducts ? ` of ${totalCatProducts}` : ''} packages
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
                            handleToggleKokos();
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
                            handleTogglePinex();
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
                          handleOpenAdd(cat.id);
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
                          toggleCategory(cat.id);
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
                            {query
                              ? `No packages found in ${cat.title} matching "${query}".`
                              : `No packages added under ${cat.title} yet.`}
                          </p>
                          <button
                            onClick={() => handleOpenAdd(cat.id)}
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
                                          onClick={() => handleToggleActive(p)}
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
                                            onClick={() => handleOpenEdit(p)}
                                            title="Edit Package"
                                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                                          >
                                            <Edit3 className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={() => setDeletingProduct(p)}
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
                                      onClick={() => handleToggleActive(p)}
                                      className="text-[11px] text-slate-400 hover:text-slate-200"
                                    >
                                      {isActive ? 'Disable in Bot' : 'Enable in Bot'}
                                    </button>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        onClick={() => handleOpenEdit(p)}
                                        className="p-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs font-semibold px-2.5 flex items-center gap-1"
                                      >
                                        <Edit3 className="w-3 h-3" />
                                        <span>Edit</span>
                                      </button>
                                      <button
                                        onClick={() => setDeletingProduct(p)}
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
            })}
          </div>
        )}
      </main>

      {/* ---------------------------------------------------- */}
      {/* ADD / EDIT PACKAGE MODAL                             */}
      {/* ---------------------------------------------------- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-dark-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <CategoryIcon categoryId={modalCategoryId} className="w-9 h-9" />
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-brand-400" />
                    <span>{isEditing ? 'Edit Package Details' : 'Add New Package'}</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Under Category: <b className="text-slate-200">{categories.find(c => c.id === modalCategoryId)?.title}</b>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {feedbackMsg && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                feedbackMsg.type === 'error'
                  ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                  : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              }`}>
                {feedbackMsg.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                <span>{feedbackMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleSavePackage} className="space-y-3.5 text-xs">
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
                  Used by WhatsApp bot to match customer queries (e.g. typing "60")
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
                  <span className={`text-base font-black ${
                    liveMargin >= 20 ? 'text-emerald-400' : liveMargin >= 10 ? 'text-indigo-300' : 'text-amber-400'
                  }`}>
                    {liveMargin}%
                  </span>
                </div>
              </div>

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
                  onClick={() => setIsModalOpen(false)}
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
      )}

      {/* ---------------------------------------------------- */}
      {/* DELETE CONFIRMATION MODAL                            */}
      {/* ---------------------------------------------------- */}
      {deletingProduct && (
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
              Are you sure you want to remove <b className="text-white">{deletingProduct.name}</b> (৳{deletingProduct.price})? It will be removed from the WhatsApp bot catalog immediately.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingProduct(null)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePackage}
                disabled={isDeleting}
                className="px-3.5 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* FACTORY RESET MODAL                                  */}
      {/* ---------------------------------------------------- */}
      {showResetModal && (
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
                onClick={() => setShowResetModal(false)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleResetDefaults}
                disabled={isResetting}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition disabled:opacity-50"
              >
                {isResetting ? 'Resetting...' : 'Confirm Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
