'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Search, X } from 'lucide-react';
import { PricingProduct, CategoryInfo, PricingStats } from './types';
import { PricingStatsRow } from './components/PricingStatsRow';
import { CategoryAccordion } from './components/CategoryAccordion';
import { PackageModal } from './components/PackageModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { ResetDefaultsModal } from './components/ResetDefaultsModal';

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
  const [modalPresetEmail, setModalPresetEmail] = useState('');
  const [modalPresetPassword, setModalPresetPassword] = useState('');
  const [modalPresetPin, setModalPresetPin] = useState('');
  const [modalPresetHasPassword, setModalPresetHasPassword] = useState(false);
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
    setModalPresetEmail('');
    setModalPresetPassword('');
    setModalPresetPin('');
    setModalPresetHasPassword(false);
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
    setModalPresetEmail(product.presetAccount?.email || '');
    setModalPresetPassword(product.presetAccount?.password || '');
    setModalPresetPin(product.presetAccount?.pin || '');
    setModalPresetHasPassword(Boolean(product.presetAccount?.hasPassword || product.presetAccount?.password));
    setFeedbackMsg(null);
    setIsModalOpen(true);
  };

  const buildPresetPayload = () => {
    const blob = `${modalPkgId} ${modalName} ${modalCategoryId}`.toLowerCase();
    if (!blob.includes('netflix') && !blob.includes('crunchyroll')) {
      return {};
    }
    // Clearing both email and password removes auto-delivery account
    if (!modalPresetEmail.trim() && !modalPresetPassword.trim()) {
      return modalPresetHasPassword ? { clearPresetAccount: true } : {};
    }
    return {
      presetEmail: modalPresetEmail.trim(),
      presetPassword: modalPresetPassword.trim(),
      presetPin: modalPresetPin.trim()
    };
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

    const streamingBlob = `${modalPkgId} ${modalName} ${modalCategoryId}`.toLowerCase();
    const isStreamingPkg =
      streamingBlob.includes('netflix') || streamingBlob.includes('crunchyroll');
    if (
      isStreamingPkg &&
      ((modalPresetEmail.trim() && !modalPresetPassword.trim()) ||
        (!modalPresetEmail.trim() && modalPresetPassword.trim()))
    ) {
      setFeedbackMsg({
        type: 'error',
        text: 'For auto-delivery, set both login email and password (or leave both empty).'
      });
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
            isActive: modalIsActive,
            ...buildPresetPayload()
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
            description: modalDescription.trim(),
            ...buildPresetPayload()
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
    } catch {
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
        <PricingStatsRow
          stats={stats}
          productCount={products.length}
          categoryCount={categories.length}
          onAddPackage={() => handleOpenAdd()}
          onResetDefaults={() => setShowResetModal(true)}
        />

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
              const isExpanded = query ? catProducts.length > 0 : expandedCategories.has(cat.id);

              return (
                <CategoryAccordion
                  key={cat.id}
                  cat={cat}
                  catProducts={catProducts}
                  totalCatProducts={totalCatProducts}
                  isExpanded={isExpanded}
                  searchQuery={query}
                  kokosAutoFulfill={kokosAutoFulfill}
                  kokosToggling={kokosToggling}
                  pinexAutoFulfill={pinexAutoFulfill}
                  pinexToggling={pinexToggling}
                  onToggleExpand={() => toggleCategory(cat.id)}
                  onToggleKokos={handleToggleKokos}
                  onTogglePinex={handleTogglePinex}
                  onAddPackage={handleOpenAdd}
                  onEditPackage={handleOpenEdit}
                  onDeletePackage={(product) => setDeletingProduct(product)}
                  onToggleActive={handleToggleActive}
                />
              );
            })}
          </div>
        )}
      </main>

      {/* ADD / EDIT PACKAGE MODAL */}
      <PackageModal
        isOpen={isModalOpen}
        isEditing={isEditing}
        categories={categories}
        modalCategoryId={modalCategoryId}
        setModalCategoryId={setModalCategoryId}
        modalName={modalName}
        setModalName={setModalName}
        modalAmount={modalAmount}
        setModalAmount={setModalAmount}
        modalPrice={modalPrice}
        setModalPrice={setModalPrice}
        modalBasePrice={modalBasePrice}
        setModalBasePrice={setModalBasePrice}
        modalDescription={modalDescription}
        setModalDescription={setModalDescription}
        modalIsActive={modalIsActive}
        setModalIsActive={setModalIsActive}
        modalPkgId={modalPkgId}
        modalPresetEmail={modalPresetEmail}
        setModalPresetEmail={setModalPresetEmail}
        modalPresetPassword={modalPresetPassword}
        setModalPresetPassword={setModalPresetPassword}
        modalPresetPin={modalPresetPin}
        setModalPresetPin={setModalPresetPin}
        modalPresetHasPassword={modalPresetHasPassword}
        feedbackMsg={feedbackMsg}
        isSaving={isSaving}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSavePackage}
      />

      {/* DELETE CONFIRMATION MODAL */}
      <DeleteConfirmModal
        product={deletingProduct}
        isDeleting={isDeleting}
        onClose={() => setDeletingProduct(null)}
        onConfirm={handleDeletePackage}
      />

      {/* FACTORY RESET MODAL */}
      <ResetDefaultsModal
        isOpen={showResetModal}
        isResetting={isResetting}
        onClose={() => setShowResetModal(false)}
        onConfirm={handleResetDefaults}
      />
    </div>
  );
}
