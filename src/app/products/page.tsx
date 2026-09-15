'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import {
  Package,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  Sparkles,
  Zap,
  DollarSign,
  TrendingUp,
  Tag,
  Boxes,
  Eye,
  EyeOff
} from 'lucide-react';
import { Product } from '@/types';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    sku: '',
    name_en: '',
    name_bn: '',
    description_en: '',
    description_bn: '',
    price: 0,
    stock_qty: 9999,
    category: 'PUBG UC',
    is_active: true
  });

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products?includeInactive=true', {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (data.success && Array.isArray(data.products)) {
          setProducts(data.products);
        }
      }
    } catch (e) {
      console.error('Failed to fetch products:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleOpenAddModal = () => {
    setFormData({
      sku: `PUBG-${Date.now().toString().slice(-4)}`,
      name_en: '',
      name_bn: '',
      description_en: 'Only Player UID needed',
      description_bn: 'শুধুমাত্র Player UID প্রয়োজন',
      price: 100,
      stock_qty: 9999,
      category: selectedCategory !== 'ALL' ? selectedCategory : 'PUBG UC',
      is_active: true
    });
    setShowAddModal(true);
  };

  const handleOpenEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      sku: p.sku,
      name_en: p.name_en,
      name_bn: p.name_bn,
      description_en: p.description_en || '',
      description_bn: p.description_bn || '',
      price: p.price,
      stock_qty: p.stock_qty,
      category: p.category,
      is_active: p.is_active
    });
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        ...(editingProduct ? { id: editingProduct.id } : {}),
        ...formData,
        price: Number(formData.price),
        stock_qty: Number(formData.stock_qty)
      };

      const res = await fetch('/api/products', {
        method: editingProduct ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setShowAddModal(false);
        setEditingProduct(null);
        await fetchProducts();
      }
    } catch (e) {
      console.error('Failed to save product:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (product: Product) => {
    try {
      const res = await fetch('/api/products', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          id: product.id,
          is_active: !product.is_active
        })
      });
      if (res.ok) {
        setProducts(prev =>
          prev.map(p => (p.id === product.id ? { ...p, is_active: !p.is_active } : p))
        );
      }
    } catch (e) {
      console.error('Failed to toggle product status:', e);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/products?id=${id}`, {
        method: 'DELETE',
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.ok) {
        setDeletingProduct(null);
        await fetchProducts();
      }
    } catch (e) {
      console.error('Failed to delete product:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Categories list
  const categories = ['ALL', 'PUBG UC', 'Growth Pack', 'Subscription'];

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesCategory =
      selectedCategory === 'ALL' ||
      p.category.toLowerCase().includes(selectedCategory.toLowerCase()) ||
      (selectedCategory === 'Subscription' && p.category.toLowerCase().includes('sub'));

    const matchesSearch =
      p.name_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.name_bn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(p.price).includes(searchQuery);

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-950 text-slate-100">
      <Header
        title="DS Dukan Product & Pricing Manager"
        subtitle="Live catalog, rates, and package manager. Any price updates here are immediately synced with the WhatsApp AI Assistant."
      />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Dynamic AI Sync Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-brand-500/10 via-brand-400/5 to-purple-500/10 border border-brand-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-500/20 text-brand-400">
              <Zap className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white">Dynamic AI Real-Time Sync</h4>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Live Active
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                When you update prices or add new packages here, the WhatsApp AI Assistant automatically self-upgrades its rate card and pricing memory.
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-950 font-bold text-xs transition shadow-lg shadow-brand-500/10 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Add Package / Rate</span>
          </button>
        </div>

        {/* Filter, Search & Category Navigation */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-2xl bg-dark-900/90 border border-slate-800/80">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by package name (e.g. 60 UC, Prime), SKU, price..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500/50"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-brand-500 text-dark-950 shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {cat === 'ALL' ? 'All Packages' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Products Matrix */}
        {loading ? (
          <div className="py-24 text-center text-xs text-slate-500 space-y-2">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Loading live catalog from database...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-dark-900/40 border border-slate-800/50 space-y-3">
            <Package className="w-10 h-10 text-slate-600 mx-auto" />
            <h4 className="text-sm font-bold text-white">No packages found</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              No packages match your search criteria. Try a different query or add a new package.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((p) => {
              const websiteDiscountPrice = Math.round(p.price * 0.98);
              return (
                <div
                  key={p.id}
                  className={`p-5 rounded-2xl bg-dark-900/90 border transition flex flex-col justify-between space-y-4 ${
                    p.is_active
                      ? 'border-slate-800/80 hover:border-slate-700'
                      : 'border-rose-950/40 opacity-70 bg-dark-900/40'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Badges Bar */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          {p.sku}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20">
                          {p.category}
                        </span>
                      </div>

                      <button
                        onClick={() => handleToggleActive(p)}
                        title={p.is_active ? 'Click to disable' : 'Click to enable'}
                        className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full transition ${
                          p.is_active
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20'
                        }`}
                      >
                        {p.is_active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        <span>{p.is_active ? 'Active' : 'Disabled'}</span>
                      </button>
                    </div>

                    {/* Titles */}
                    <div>
                      <h4 className="font-bold text-white text-base">{p.name_bn || p.name_en}</h4>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">{p.name_en}</p>
                    </div>

                    {/* Description */}
                    {p.description_bn && (
                      <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                        {p.description_bn}
                      </p>
                    )}
                  </div>

                  {/* Pricing & Actions */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs text-slate-400">Regular:</span>
                        <span className="text-lg font-black text-brand-400">
                          {p.price > 0 ? `৳${p.price}` : 'Live Rate'}
                        </span>
                      </div>
                      {p.price > 0 && (
                        <div className="text-[10px] text-emerald-400 font-medium">
                          Website 2% Off: ৳{websiteDiscountPrice}
                        </div>
                      )}
                    </div>

                    {/* Edit & Delete Action Buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditModal(p)}
                        className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white transition"
                        title="Edit Price & Details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingProduct(p)}
                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition"
                        title="Delete Product"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add / Edit Product Modal */}
        {(showAddModal || editingProduct) && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-dark-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">
                      {editingProduct ? 'Edit Package & Pricing' : 'Add New Top-Up Package'}
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      Changes will instantly propagate to the WhatsApp AI Agent
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingProduct(null);
                  }}
                  className="text-slate-400 hover:text-white text-xs p-1"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">SKU Code</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. PUBG-UC-60"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-brand-500"
                    >
                      <option value="PUBG UC">PUBG UC</option>
                      <option value="Growth Pack">Growth Pack</option>
                      <option value="Subscription">Subscription</option>
                      <option value="Special Offer">Special Offer</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Name (Bengali / বাংলা)</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ৬০ ইউসি (60 UC)"
                      value={formData.name_bn}
                      onChange={(e) => setFormData({ ...formData, name_bn: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Name (English)</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 60 UC"
                      value={formData.name_en}
                      onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-brand-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Price (৳ BDT)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      placeholder="115"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold text-brand-400 focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Stock Quantity</label>
                    <input
                      type="number"
                      required
                      value={formData.stock_qty}
                      onChange={(e) => setFormData({ ...formData, stock_qty: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Description / Note (বাংলা)</label>
                  <input
                    type="text"
                    placeholder="e.g. শুধুমাত্র Player UID প্রয়োজন"
                    value={formData.description_bn}
                    onChange={(e) => setFormData({ ...formData, description_bn: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-brand-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="isActiveCheck"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded border-slate-800 text-brand-500 focus:ring-brand-500"
                  />
                  <label htmlFor="isActiveCheck" className="text-slate-300 font-medium">
                    Package is active and visible in WhatsApp catalog
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingProduct(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl bg-brand-500 text-dark-950 font-bold hover:bg-brand-400 transition"
                  >
                    {isSubmitting ? 'Saving...' : editingProduct ? 'Update Price & Package' : 'Create Package'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deletingProduct && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-dark-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4">
              <div className="flex items-center gap-3 text-rose-400">
                <AlertCircle className="w-6 h-6" />
                <h3 className="font-bold text-white text-sm">Delete Package?</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Are you sure you want to delete <strong className="text-white">{deletingProduct.name_en}</strong> (৳{deletingProduct.price})? The AI agent will no longer offer this package.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setDeletingProduct(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteProduct(deletingProduct.id)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs"
                >
                  {isSubmitting ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

