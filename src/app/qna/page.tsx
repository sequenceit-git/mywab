'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import {
  HelpCircle,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  MessageSquare,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  BookOpen,
  Filter
} from 'lucide-react';
import { FAQ } from '@/types';

const CATEGORIES = [
  'All',
  'Pricing & UC',
  'Greetings',
  'Ordering',
  'Subscriptions',
  'Delivery & Website',
  'Security & Policy',
  'Payment'
];

export default function QnaPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [formData, setFormData] = useState({
    question_en: '',
    question_bn: '',
    answer_en: '',
    answer_bn: '',
    category: 'Pricing & UC',
    is_active: true
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchFaqs = async () => {
    try {
      const res = await fetch('/api/faqs?all=true', {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (data.success && Array.isArray(data.faqs)) {
          setFaqs(data.faqs);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFaqs();
  }, []);

  const handleOpenCreate = () => {
    setEditingFaq(null);
    setFormData({
      question_en: '',
      question_bn: '',
      answer_en: '',
      answer_bn: '',
      category: selectedCategory !== 'All' ? selectedCategory : 'Pricing & UC',
      is_active: true
    });
    setShowModal(true);
  };

  const handleOpenEdit = (faq: FAQ) => {
    setEditingFaq(faq);
    setFormData({
      question_en: faq.question_en,
      question_bn: faq.question_bn,
      answer_en: faq.answer_en,
      answer_bn: faq.answer_bn,
      category: faq.category || 'General',
      is_active: faq.is_active
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/faqs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          id: editingFaq ? editingFaq.id : undefined,
          ...formData
        })
      });

      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (data.success) {
          setShowModal(false);
          fetchFaqs();
        }
      }
    } catch (e) {
      console.error('Failed to save Q&A:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (faq: FAQ) => {
    try {
      const res = await fetch('/api/faqs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          ...faq,
          is_active: !faq.is_active
        })
      });

      if (res.ok) {
        setFaqs(prev =>
          prev.map(f => (f.id === faq.id ? { ...f, is_active: !f.is_active } : f))
        );
      }
    } catch (e) {
      console.error('Failed to toggle status:', e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Q&A entry?')) return;
    try {
      const res = await fetch(`/api/faqs?id=${id}`, {
        method: 'DELETE',
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.ok) {
        setFaqs(prev => prev.filter(f => f.id !== id));
      }
    } catch (e) {
      console.error('Failed to delete Q&A:', e);
    }
  };

  const filteredFaqs = faqs.filter(faq => {
    const matchesCategory = selectedCategory === 'All' || faq.category === selectedCategory;
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      faq.question_en.toLowerCase().includes(query) ||
      faq.question_bn.includes(query) ||
      faq.answer_en.toLowerCase().includes(query) ||
      faq.answer_bn.includes(query) ||
      faq.category.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Q&A & AI Knowledge Base"
        subtitle="Manage customer questions, pricing replies, presence checks, and automated store policies"
      />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-400" />
              <span>AI Trained Q&A List</span>
              <span className="text-xs bg-brand-500/20 text-brand-400 font-mono px-2 py-0.5 rounded-full border border-brand-500/30">
                {faqs.length} Entries
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              When customers ask questions on WhatsApp, the AI matches these Q&As to give immediate answers.
            </p>
          </div>

          <button
            onClick={handleOpenCreate}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-950 font-bold text-xs transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Q&A</span>
          </button>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-dark-900/90 border border-slate-800/80">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Q&A by question, keyword, or answer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500/50"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-brand-500 text-dark-950 shadow-sm'
                    : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Q&A Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading ? (
            <div className="col-span-2 py-16 text-center text-xs text-slate-500">Loading Q&A list...</div>
          ) : filteredFaqs.length === 0 ? (
            <div className="col-span-2 py-16 text-center text-xs text-slate-500">
              No Q&A entries found matching "{searchQuery}". Click "Add New Q&A" to create one.
            </div>
          ) : (
            filteredFaqs.map((faq) => (
              <div
                key={faq.id}
                className="p-5 rounded-2xl bg-dark-900/90 border border-slate-800/80 hover:border-slate-700 transition flex flex-col justify-between space-y-4 shadow-sm"
              >
                <div className="space-y-3">
                  {/* Category & Status */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20">
                      {faq.category || 'General'}
                    </span>
                    <button
                      onClick={() => handleToggleActive(faq)}
                      className={`flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full transition ${
                        faq.is_active
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${faq.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
                      {faq.is_active ? 'Active' : 'Disabled'}
                    </button>
                  </div>

                  {/* Questions */}
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-white flex items-start gap-1.5">
                      <span className="text-brand-400 font-mono">Q:</span>
                      <span>{faq.question_bn || faq.question_en}</span>
                    </div>
                    {faq.question_en && faq.question_en !== faq.question_bn && (
                      <div className="text-[11px] text-slate-400 pl-4 font-mono">
                        Keywords / Banglish: {faq.question_en}
                      </div>
                    )}
                  </div>

                  {/* Answers */}
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/60 text-xs text-slate-300 space-y-1.5">
                    <div className="text-[10px] uppercase font-bold text-slate-500">AI Response:</div>
                    <p className="whitespace-pre-line text-slate-200 leading-relaxed text-[11px]">
                      {faq.answer_bn || faq.answer_en}
                    </p>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-slate-500">
                    ID: <code className="font-mono text-slate-400">{faq.id}</code>
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEdit(faq)}
                      className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                      title="Edit Q&A"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(faq.id)}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition border border-red-500/20"
                      title="Delete Q&A"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-dark-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">
                  {editingFaq ? 'Edit Q&A Entry' : 'Create New Q&A'}
                </h3>
                <p className="text-xs text-slate-400">
                  Configure question patterns and the exact AI response
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Category */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500/50"
                >
                  {CATEGORIES.filter(c => c !== 'All').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Question in Bengali */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Question (বাংলা)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ৬০ ইউসি কত টাকা? / ইউসি প্রাইস লিস্ট"
                  value={formData.question_bn}
                  onChange={(e) => setFormData({ ...formData, question_bn: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500/50"
                />
              </div>

              {/* Question Keywords / Banglish / English */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Keywords / Banglish / English Query</label>
                <input
                  type="text"
                  placeholder="e.g. 60 uc koto tk / uc price list / bhai acen"
                  value={formData.question_en}
                  onChange={(e) => setFormData({ ...formData, question_en: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500/50"
                />
                <span className="text-[10px] text-slate-500">
                  Multiple variations or keywords help the AI match customer queries accurately.
                </span>
              </div>

              {/* Answer in Bengali */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">AI Answer / Response (বাংলা / English)</label>
                <textarea
                  rows={4}
                  required
                  placeholder="e.g. ৬০ ইউসি (60 UC) এর দাম মাত্র ১১৫ টাকা। শুধুমাত্র Player UID প্রয়োজন। ডেলিভারি ৫–১৫ মিনিট।"
                  value={formData.answer_bn}
                  onChange={(e) => setFormData({ ...formData, answer_bn: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-brand-500/50 resize-y"
                />
              </div>

              {/* Status Toggle */}
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-800 text-brand-500 focus:ring-0"
                />
                <label htmlFor="isActiveToggle" className="text-slate-300 font-medium cursor-pointer">
                  Active (Allow AI to use this answer in customer chats)
                </label>
              </div>

              {/* Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-950 font-bold text-xs transition shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingFaq ? 'Save Changes' : 'Create Q&A'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
