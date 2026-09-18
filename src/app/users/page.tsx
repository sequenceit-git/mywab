'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Trophy,
  Crown,
  Search,
  ArrowUpDown,
  Phone,
  Gamepad2,
  ExternalLink,
  ShieldCheck,
  Award,
  DollarSign,
  ShoppingBag,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Copy,
  Check
} from 'lucide-react';
import { UserLeaderboardEntry } from '@/types';
import { WhatsAppIcon } from '@/components/BrandIcons';
import { Header } from '@/components/Header';

export default function UsersLeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<UserLeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'VIP' | 'TOP_SPENDERS' | 'RECENT'>('ALL');
  const [sortBy, setSortBy] = useState<'SPENT' | 'ORDERS' | 'RECENT'>('SPENT');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const fetchLeaderboard = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.success && Array.isArray(data.leaderboard)) {
        setLeaderboard(data.leaderboard);
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleUpdateStatus = async (userId: string, newStatus: 'VIP' | 'REGULAR' | 'FLAGGED') => {
    setUpdatingUserId(userId);
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, statusTag: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        setLeaderboard(prev =>
          prev.map(u => (u.id === userId ? { ...u, status_tag: newStatus } : u))
        );
      }
    } catch (err) {
      console.error('Failed to update user status:', err);
    } finally {
      setUpdatingUserId(null);
    }
  };

  // KPIs
  const totalCustomers = leaderboard.length;
  const totalSpentAll = leaderboard.reduce((sum, u) => sum + (u.total_spent || 0), 0);
  const totalOrdersAll = leaderboard.reduce((sum, u) => sum + (u.total_orders || 0), 0);
  const vipCount = leaderboard.filter(u => u.status_tag === 'VIP').length;
  const avgLtv = totalCustomers > 0 ? Math.round(totalSpentAll / totalCustomers) : 0;

  // Filter and Sort
  const filteredLeaderboard = useMemo(() => {
    return leaderboard
      .filter(user => {
        const matchesSearch =
          (user.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (user.phone_number || '').includes(searchQuery) ||
          (user.latest_uid || '').includes(searchQuery) ||
          user.saved_uids.some(uid => uid.includes(searchQuery));

        if (!matchesSearch) return false;

        if (selectedFilter === 'VIP') return user.status_tag === 'VIP';
        if (selectedFilter === 'TOP_SPENDERS') return user.total_spent >= 500;
        if (selectedFilter === 'RECENT') return Boolean(user.last_order_at);
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'SPENT') return b.total_spent - a.total_spent;
        if (sortBy === 'ORDERS') return b.total_orders - a.total_orders;
        if (sortBy === 'RECENT') {
          const dateA = a.last_order_at ? new Date(a.last_order_at).getTime() : 0;
          const dateB = b.last_order_at ? new Date(b.last_order_at).getTime() : 0;
          return dateB - dateA;
        }
        return a.rank - b.rank;
      });
  }, [leaderboard, searchQuery, selectedFilter, sortBy]);

  const topThree = leaderboard.slice(0, 3);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-950">
      <Header
        title="Customer Leaderboard & Loyalty"
        subtitle="Unique customers, lifetime purchases, game top-up preferences, and VIP rankings"
      />

      <main className="p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6 pb-20 lg:pb-6">
        {/* Leaderboard Title Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20 shrink-0">
                <Trophy className="w-5 h-5 font-bold" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Customer Leaderboard</h1>
                <p className="text-xs sm:text-sm text-slate-400">Unique customers, lifetime purchases, and loyalty rankings</p>
              </div>
            </div>
          </div>

          <button
            onClick={fetchLeaderboard}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-200 text-xs sm:text-sm font-medium transition self-start sm:self-auto shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh List
          </button>
        </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase">Customers</span>
            <Users className="w-4 h-4 text-brand-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-extrabold text-white">{totalCustomers}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">{vipCount} VIP members</span>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase">Total Revenue</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-extrabold text-emerald-400">৳{totalSpentAll.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Across all purchases</span>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase">Fulfilled Orders</span>
            <ShoppingBag className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-extrabold text-white">{totalOrdersAll}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Delivered orders</span>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase">Avg LTV</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-extrabold text-amber-300">৳{avgLtv.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Average spent / user</span>
          </div>
        </div>
      </div>

      {/* Top 3 Podium Cards */}
      {topThree.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {topThree.map((user, idx) => {
            const isFirst = idx === 0;
            const isSecond = idx === 1;
            const isThird = idx === 2;

            const badgeBg = isFirst
              ? 'from-amber-500/20 via-amber-500/5 to-slate-900 border-amber-500/40 shadow-lg shadow-amber-500/10'
              : isSecond
              ? 'from-slate-400/20 via-slate-400/5 to-slate-900 border-slate-400/40'
              : 'from-orange-500/20 via-orange-500/5 to-slate-900 border-orange-500/40';

            const crownColor = isFirst
              ? 'text-amber-400 bg-amber-400/20'
              : isSecond
              ? 'text-slate-300 bg-slate-300/20'
              : 'text-orange-400 bg-orange-400/20';

            return (
              <div
                key={user.id}
                className={`p-4 sm:p-6 rounded-2xl bg-gradient-to-b ${badgeBg} border relative overflow-hidden backdrop-blur-md`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 sm:w-12 h-10 sm:h-12 rounded-xl flex items-center justify-center font-bold text-sm sm:text-lg ${crownColor}`}>
                      {isFirst ? '🥇 #1' : isSecond ? '🥈 #2' : '🥉 #3'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm sm:text-base">
                          {user.name || 'Anonymous Gamer'}
                        </span>
                        {user.status_tag === 'VIP' && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                            VIP
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" />
                        {user.phone_number}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] font-medium uppercase text-slate-400">Total Spent</span>
                    <p className="text-base sm:text-lg font-extrabold text-emerald-400">৳{(user.total_spent || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-medium uppercase text-slate-400">Orders</span>
                    <p className="text-base sm:text-lg font-bold text-white">{user.total_orders}</p>
                  </div>
                </div>

                {user.latest_uid && (
                  <div className="mt-3 text-xs text-slate-400 flex items-center gap-1.5 bg-slate-950/40 px-2.5 py-1.5 rounded-lg border border-slate-800/60">
                    <Gamepad2 className="w-3.5 h-3.5 text-brand-400" />
                    <span className="text-slate-500 text-[11px]">Latest Account/UID:</span>
                    <span className="font-mono text-slate-300">{user.latest_uid}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search phone, name, email, UID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-brand-500 transition"
          />
        </div>

        {/* Filter Tabs & Sort Dropdown */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex p-1 rounded-xl bg-slate-900/90 border border-slate-800 text-xs overflow-x-auto scrollbar-none">
            <button
              onClick={() => setSelectedFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
                selectedFilter === 'ALL' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({leaderboard.length})
            </button>
            <button
              onClick={() => setSelectedFilter('TOP_SPENDERS')}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
                selectedFilter === 'TOP_SPENDERS' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              🔥 Top Spenders
            </button>
            <button
              onClick={() => setSelectedFilter('VIP')}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
                selectedFilter === 'VIP' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              👑 VIP
            </button>
          </div>

          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-xl text-xs text-slate-400">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-transparent text-white text-xs font-medium focus:outline-none cursor-pointer"
            >
              <option value="SPENT" className="bg-slate-900">Highest Spent</option>
              <option value="ORDERS" className="bg-slate-900">Most Orders</option>
              <option value="RECENT" className="bg-slate-900">Recently Active</option>
            </select>
          </div>
        </div>
      </div>

      {/* Mobile Customer Cards (md:hidden) */}
      <div className="md:hidden space-y-3">
        {filteredLeaderboard.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-slate-900/50 rounded-2xl border border-slate-800 text-xs">
            No customers found matching your criteria.
          </div>
        ) : (
          filteredLeaderboard.map((user) => {
            const cleanPhone = (user.phone_number || '').replace(/\D/g, '');
            const waLink = `https://wa.me/${cleanPhone}`;

            return (
              <div
                key={user.id}
                className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/90 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-white text-xs border border-slate-700">
                      #{user.rank}
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm">{user.name || 'Gamer Customer'}</div>
                      <div className="text-xs font-mono text-slate-400 flex items-center gap-1">
                        <span>{user.phone_number}</span>
                        <button
                          onClick={() => handleCopy(user.phone_number, `m-phone-${user.id}`)}
                          className="text-slate-500 hover:text-white"
                        >
                          {copiedId === `m-phone-${user.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <select
                    value={user.status_tag || 'REGULAR'}
                    disabled={updatingUserId === user.id}
                    onChange={e => handleUpdateStatus(user.id, e.target.value as any)}
                    className={`text-[11px] font-bold px-2 py-1 rounded-lg border focus:outline-none transition ${
                      user.status_tag === 'VIP'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : user.status_tag === 'FLAGGED'
                        ? 'bg-red-500/20 text-red-300 border-red-500/30'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    <option value="REGULAR" className="bg-slate-900 text-slate-300">REGULAR</option>
                    <option value="VIP" className="bg-slate-900 text-amber-300">👑 VIP</option>
                    <option value="FLAGGED" className="bg-slate-900 text-red-300">🚩 FLAGGED</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/60 text-xs">
                  <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/40">
                    <span className="text-[10px] uppercase text-slate-400 block font-medium">Total Spent</span>
                    <span className="font-black text-emerald-400 text-sm">৳{(user.total_spent || 0).toLocaleString()}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/40">
                    <span className="text-[10px] uppercase text-slate-400 block font-medium">Orders</span>
                    <span className="font-bold text-white text-sm">{user.total_orders}</span>
                  </div>
                </div>

                {user.saved_uids.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap text-[11px] pt-1">
                    <span className="text-slate-400">UIDs:</span>
                    {user.saved_uids.slice(0, 2).map((uid, uIdx) => (
                      <span key={uIdx} className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono text-slate-300">
                        {uid}
                      </span>
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">
                    {user.last_order_at ? `Last: ${new Date(user.last_order_at).toLocaleDateString()}` : 'No orders yet'}
                  </span>
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-semibold"
                  >
                    <WhatsAppIcon className="w-3 h-3" />
                    <span>WhatsApp</span>
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Main Desktop Leaderboard Table (hidden on mobile) */}
      <div className="hidden md:block bg-slate-900/70 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-sm shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-950/40">
                <th className="py-4 px-4 text-center w-16">Rank</th>
                <th className="py-4 px-4">Customer</th>
                <th className="py-4 px-4">Status</th>
                <th className="py-4 px-4 text-right">Total Spent</th>
                <th className="py-4 px-4 text-center">Orders</th>
                <th className="py-4 px-4">Account / UIDs</th>
                <th className="py-4 px-4">Last Order</th>
                <th className="py-4 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-sm">
              {filteredLeaderboard.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No customers found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredLeaderboard.map((user, idx) => {
                  const cleanPhone = (user.phone_number || '').replace(/\D/g, '');
                  const waLink = `https://wa.me/${cleanPhone}`;

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-800/40 transition group"
                    >
                      {/* Rank */}
                      <td className="py-4 px-4 text-center font-bold">
                        {user.rank === 1 ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/20 text-amber-300 font-extrabold text-xs border border-amber-500/40 shadow-sm">
                            1
                          </span>
                        ) : user.rank === 2 ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-400/20 text-slate-300 font-extrabold text-xs border border-slate-400/40">
                            2
                          </span>
                        ) : user.rank === 3 ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-500/20 text-orange-300 font-extrabold text-xs border border-orange-500/40">
                            3
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs font-semibold">
                            #{user.rank}
                          </span>
                        )}
                      </td>

                      {/* Customer Info */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-slate-800 to-slate-700 flex items-center justify-center font-bold text-white text-xs border border-slate-700">
                            {(user.name?.[0] || user.phone_number.slice(-2)).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-white group-hover:text-brand-300 transition">
                              {user.name || 'Gamer Customer'}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                              <span className="font-mono">{user.phone_number}</span>
                              <button
                                onClick={() => handleCopy(user.phone_number, `phone-${user.id}`)}
                                title="Copy Phone"
                                className="text-slate-500 hover:text-white transition"
                              >
                                {copiedId === `phone-${user.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status Tag */}
                      <td className="py-4 px-4">
                        <select
                          value={user.status_tag || 'REGULAR'}
                          disabled={updatingUserId === user.id}
                          onChange={e => handleUpdateStatus(user.id, e.target.value as any)}
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg border focus:outline-none cursor-pointer transition ${
                            user.status_tag === 'VIP'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30'
                              : user.status_tag === 'FLAGGED'
                              ? 'bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30'
                              : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700/80'
                          }`}
                        >
                          <option value="REGULAR" className="bg-slate-900 text-slate-300">REGULAR</option>
                          <option value="VIP" className="bg-slate-900 text-amber-300">👑 VIP</option>
                          <option value="FLAGGED" className="bg-slate-900 text-red-300">🚩 FLAGGED</option>
                        </select>
                      </td>

                      {/* Total Spent */}
                      <td className="py-4 px-4 text-right font-bold text-emerald-400 text-sm">
                        ৳{(user.total_spent || 0).toLocaleString()}
                      </td>

                      {/* Orders */}
                      <td className="py-4 px-4 text-center">
                        <span className="font-semibold text-white">{user.total_orders}</span>
                        {user.delivered_orders > 0 && (
                          <span className="text-[10px] text-emerald-400 ml-1">
                            ({user.delivered_orders} done)
                          </span>
                        )}
                      </td>

                      {/* Player UIDs */}
                      <td className="py-4 px-4">
                        {user.saved_uids.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {user.saved_uids.slice(0, 2).map((uid, uIdx) => (
                              <span
                                key={uIdx}
                                className="px-2 py-0.5 rounded bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-300"
                              >
                                {uid}
                              </span>
                            ))}
                            {user.saved_uids.length > 2 && (
                              <span className="text-[10px] text-slate-500 self-center">
                                +{user.saved_uids.length - 2} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>

                      {/* Last Order Date */}
                      <td className="py-4 px-4 text-xs text-slate-400">
                        {user.last_order_at ? (
                          new Date(user.last_order_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })
                        ) : (
                          <span className="text-slate-600">No orders yet</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-medium transition"
                        >
                          <span>WhatsApp</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  </div>
);
}
