'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import {
  Package,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Edit2
} from 'lucide-react';
import { Product } from '@/types';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProduct, setNewProduct] = useState({
    sku: '',
    name_en: '',
    name_bn: '',
    description_en: '',
    description_bn: '',
    price: 0,
    stock_qty: 10,
    category: 'Clothing'
  });

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products', {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (data.success && Array.isArray(data.products)) {
          setProducts(data.products);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify(newProduct)
      });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (data.success) {
          setShowAddModal(false);
          fetchProducts();
          setNewProduct({
            sku: '',
            name_en: '',
            name_bn: '',
            description_en: '',
            description_bn: '',
            price: 0,
            stock_qty: 10,
            category: 'Clothing'
          });
        }
      }
    } catch (e) {
      console.error('Failed to create product:', e);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Product Catalog & Stock"
        subtitle="Manage bilingual product catalog used by the LangChain OpenAI assistant"
      />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">All Store Products</h3>
            <p className="text-xs text-slate-400">Products are automatically indexed for WhatsApp AI search</p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-950 font-bold text-xs transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-3 py-16 text-center text-xs text-slate-500">Loading catalog...</div>
          ) : products.map((p) => (
            <div
              key={p.id}
              className="p-5 rounded-2xl bg-dark-900/90 border border-slate-800/80 hover:border-slate-700 transition flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    {p.sku}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-brand-400">
                    {p.category}
                  </span>
                </div>

                <div className="mt-3 space-y-1">
                  <h4 className="font-bold text-white text-sm">{p.name_bn}</h4>
                  <p className="text-xs text-slate-400 font-medium">{p.name_en}</p>
                </div>

                {p.description_bn && (
                  <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                    {p.description_bn}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800/70 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400">Price: </span>
                  <span className="text-base font-extrabold text-brand-400">৳{p.price}</span>
                </div>
                <div className="text-xs font-semibold text-slate-300">
                  Stock: <span className={p.stock_qty > 0 ? 'text-emerald-400' : 'text-rose-400'}>{p.stock_qty} pcs</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add Product Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-dark-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-white text-sm">Add New Product to Catalog</h3>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white text-xs">
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">SKU (Unique Code)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. TSHIRT-RED-L"
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Name (Bengali / বাংলা)</label>
                    <input
                      type="text"
                      required
                      placeholder="প্রিমিয়াম টি-শার্ট"
                      value={newProduct.name_bn}
                      onChange={(e) => setNewProduct({ ...newProduct, name_bn: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Name (English)</label>
                    <input
                      type="text"
                      required
                      placeholder="Premium T-Shirt"
                      value={newProduct.name_en}
                      onChange={(e) => setNewProduct({ ...newProduct, name_en: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Price (৳ BDT)</label>
                    <input
                      type="number"
                      required
                      value={newProduct.price}
                      onChange={(e) => setNewProduct({ ...newProduct, price: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Stock Qty</label>
                    <input
                      type="number"
                      required
                      value={newProduct.stock_qty}
                      onChange={(e) => setNewProduct({ ...newProduct, stock_qty: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Category</label>
                    <input
                      type="text"
                      value={newProduct.category}
                      onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-brand-500 text-dark-950 font-bold text-xs"
                  >
                    Save Product
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
