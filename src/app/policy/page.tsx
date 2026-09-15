'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import {
  ShieldAlert,
  ShieldCheck,
  Plus,
  Search,
  CheckCircle2,
  AlertOctagon,
  Edit2,
  Trash2,
  Sparkles,
  Zap,
  Check,
  X,
  Sliders,
  HelpCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { AIPolicy } from '@/types';

export default function PolicyPage() {
  const [policies, setPolicies] = useState<AIPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'ALL' | 'DO' | 'DONT'>('ALL');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<AIPolicy | null>(null);
  const [deletingPolicy, setDeletingPolicy] = useState<AIPolicy | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    type: 'DO' as 'DO' | 'DONT',
    title: '',
    rule_bn: '',
    rule_en: '',
    category: 'Ordering & Safety',
    priority: 1,
    is_active: true
  });

  const fetchPolicies = async () => {
    try {
      const res = await fetch('/api/policy?includeInactive=true', {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (data.success && Array.isArray(data.policies)) {
          setPolicies(data.policies);
        }
      }
    } catch (e) {
      console.error('Failed to fetch policies:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const handleOpenAddModal = () => {
    setFormData({
      type: selectedType !== 'ALL' ? selectedType : 'DO',
      title: '',
      rule_bn: '',
      rule_en: '',
      category: 'General',
      priority: policies.length + 1,
      is_active: true
    });
    setShowAddModal(true);
  };

  const handleOpenEditModal = (p: AIPolicy) => {
    setEditingPolicy(p);
    setFormData({
      type: p.type,
      title: p.title,
      rule_bn: p.rule_bn,
      rule_en: p.rule_en,
      category: p.category,
      priority: p.priority || 1,
      is_active: p.is_active
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.rule_bn) return;
    setIsSubmitting(true);

    try {
      if (editingPolicy) {
        // Update
        const res = await fetch('/api/policy', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingPolicy.id,
            ...formData
          })
        });
        if (res.ok) {
          setEditingPolicy(null);
          fetchPolicies();
        }
      } else {
        // Create
        const res = await fetch('/api/policy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        if (res.ok) {
          setShowAddModal(false);
          fetchPolicies();
        }
      }
    } catch (err) {
      console.error('Error saving policy:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (p: AIPolicy) => {
    try {
      const res = await fetch('/api/policy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: p.id,
          is_active: !p.is_active
        })
      });
      if (res.ok) {
        fetchPolicies();
      }
    } catch (err) {
      console.error('Error toggling policy active state:', err);
    }
  };

  const handleDelete = async () => {
    if (!deletingPolicy) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/policy?id=${deletingPolicy.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setDeletingPolicy(null);
        fetchPolicies();
      }
    } catch (err) {
      console.error('Error deleting policy:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPolicies = policies.filter((p) => {
    const matchesType = selectedType === 'ALL' || p.type === selectedType;
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.rule_bn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.rule_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const doCount = policies.filter(p => p.type === 'DO').length;
  const dontCount = policies.filter(p => p.type === 'DONT').length;

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-950">
      <Header
        title="AI Policy & Safety Rules"
        subtitle="Define explicit boundaries: what the WhatsApp AI Assistant CAN do and what it MUST NOT do"
      />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Banner with sync indicator */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-dark-900 via-slate-900 to-indigo-950/40 border border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">AI Policy & Behavioral Guardrails</h2>
                <span className="text-[10px] uppercase font-extrabold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Active in LangChain
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Rules defined here are injected in real-time into the AI prompt to prevent unauthorized discounts, password requests, and data leaks.
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-950 font-bold text-xs transition shadow-md shadow-brand-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Policy Rule</span>
          </button>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-dark-900/90 border border-slate-800/80">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search policy by title, rule or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500/50"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedType('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                selectedType === 'ALL'
                  ? 'bg-brand-500 text-dark-950 shadow-sm'
                  : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              All Rules ({policies.length})
            </button>
            <button
              onClick={() => setSelectedType('DO')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                selectedType === 'DO'
                  ? 'bg-emerald-500 text-dark-950 shadow-sm'
                  : 'bg-slate-800/60 text-slate-400 hover:text-emerald-400 hover:bg-slate-800'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              What AI CAN Do ({doCount})
            </button>
            <button
              onClick={() => setSelectedType('DONT')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                selectedType === 'DONT'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'bg-slate-800/60 text-slate-400 hover:text-rose-400 hover:bg-slate-800'
              }`}
            >
              <X className="w-3.5 h-3.5" />
              What AI MUST NOT Do ({dontCount})
            </button>
          </div>
        </div>

        {/* Policy Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading ? (
            <div className="col-span-full py-16 text-center text-slate-500 text-xs">
              Loading AI policy rules...
            </div>
          ) : filteredPolicies.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-500 text-xs">
              No policy rules match your search.
            </div>
          ) : (
            filteredPolicies.map((policy) => {
              const isDo = policy.type === 'DO';

              return (
                <div
                  key={policy.id}
                  className={`p-5 rounded-2xl border transition-all relative flex flex-col justify-between ${
                    isDo
                      ? 'bg-emerald-950/10 border-emerald-500/20 hover:border-emerald-500/40'
                      : 'bg-rose-950/10 border-rose-500/20 hover:border-rose-500/40'
                  } ${!policy.is_active ? 'opacity-50' : ''}`}
                >
                  <div className="space-y-3">
                    {/* Header line */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                            isDo
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {isDo ? <Check className="w-3 h-3" /> : <AlertOctagon className="w-3 h-3" />}
                          {isDo ? 'WHAT AI CAN DO (DO)' : 'STRICT PROHIBITION (DONT)'}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                          {policy.category}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleActive(policy)}
                          title={policy.is_active ? 'Deactivate Rule' : 'Activate Rule'}
                          className={`p-1.5 rounded-lg transition ${
                            policy.is_active
                              ? 'text-emerald-400 hover:bg-emerald-500/10'
                              : 'text-slate-500 hover:bg-slate-800'
                          }`}
                        >
                          {policy.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(policy)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingPolicy(policy)}
                          className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Title */}
                    <div>
                      <h3 className="text-sm font-bold text-white tracking-tight">{policy.title}</h3>
                    </div>

                    {/* Bengali Rule */}
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        বাংলা নির্দেশিকা (Bengali Rule)
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed">{policy.rule_bn}</p>
                    </div>

                    {/* English Rule */}
                    {policy.rule_en && (
                      <div className="text-[11px] text-slate-400 leading-relaxed">
                        <span className="font-semibold text-slate-300">Prompt Rule:</span> {policy.rule_en}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
                    <span>Priority: #{policy.priority || 1}</span>
                    <span>Status: <b className={policy.is_active ? 'text-emerald-400' : 'text-slate-500'}>{policy.is_active ? 'Active in AI' : 'Disabled'}</b></span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal: Add or Edit Policy */}
        {(showAddModal || editingPolicy) && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-dark-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-brand-400" />
                  {editingPolicy ? 'Edit Policy Rule' : 'Create New Policy Rule'}
                </h3>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingPolicy(null);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                {/* Type Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Rule Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'DO' })}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-2 ${
                        formData.type === 'DO'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-sm'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      DO (What AI Can Do)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'DONT' })}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-2 ${
                        formData.type === 'DONT'
                          ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 shadow-sm'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <X className="w-4 h-4" />
                      DONT (Strict Prohibition)
                    </button>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Rule Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. NEVER Ask for Passwords"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500/50"
                  />
                </div>

                {/* Category & Priority */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
                    <input
                      type="text"
                      placeholder="e.g. Security, Pricing, Delivery"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Priority Order</label>
                    <input
                      type="number"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500/50"
                    />
                  </div>
                </div>

                {/* Bengali Rule */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">বাংলা নির্দেশিকা (Bengali Rule Description)</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="কখনোই গ্রাহকের গেম পাসওয়ার্ড বা ফেসবুক লগইন চাইবেন না..."
                    value={formData.rule_bn}
                    onChange={(e) => setFormData({ ...formData, rule_bn: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500/50"
                  />
                </div>

                {/* English Prompt Rule */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">English System Prompt Guardrail</label>
                  <textarea
                    rows={2}
                    placeholder="NEVER ask for or accept customer PUBG passwords or social logins..."
                    value={formData.rule_en}
                    onChange={(e) => setFormData({ ...formData, rule_en: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500/50"
                  />
                </div>

                {/* Active Checkbox */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-950 text-brand-500 focus:ring-0"
                  />
                  <label htmlFor="is_active" className="text-xs text-slate-300 cursor-pointer">
                    Enable and enforce this rule immediately in WhatsApp AI Agent
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingPolicy(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-950 text-xs font-bold transition disabled:opacity-50 shadow-sm"
                  >
                    {isSubmitting ? 'Saving...' : editingPolicy ? 'Update Rule' : 'Save Rule'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Delete Confirmation */}
        {deletingPolicy && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-dark-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl text-center">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Delete Policy Rule?</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Are you sure you want to remove &quot;{deletingPolicy.title}&quot;? The AI will no longer enforce this rule in conversations.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingPolicy(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleDelete}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition disabled:opacity-50 shadow-sm"
                >
                  {isSubmitting ? 'Deleting...' : 'Delete Rule'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
