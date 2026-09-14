'use client';

import React from 'react';
import { Bell, Sparkles, RefreshCw, LogOut, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthContext';

export interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export function Header({ title = 'Operations Hub', subtitle }: HeaderProps) {
  const { user, logout } = useAuth();

  const userInitials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'AD';

  return (
    <header className="h-16 border-b border-slate-800/80 bg-dark-900/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Simulator Callout */}
        <Link
          href="/simulator"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-xs font-semibold hover:bg-indigo-500/25 transition-all shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-spin" style={{ animationDuration: '6s' }} />
          <span>Test Live Simulator</span>
        </Link>

        {/* Live sync pulse */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs text-slate-300">
          <RefreshCw className="w-3 h-3 text-brand-400 animate-spin" style={{ animationDuration: '8s' }} />
          <span className="hidden sm:inline">Real-time Sync</span>
        </div>

        {/* Admin Profile & Logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-md">
            {userInitials}
          </div>
          <div className="hidden md:block text-left text-xs">
            <div className="font-semibold text-slate-200">{user?.name || 'Admin User'}</div>
            <div className="text-[10px] text-slate-400 truncate max-w-[120px]">{user?.email || 'admin@sequenceit.software'}</div>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="p-1.5 ml-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
