'use client';

import React from 'react';
import { Bell, Sparkles, RefreshCw, Bot, Database, MessageSquare } from 'lucide-react';
import Link from 'next/link';

export interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export function Header({ title = 'Operations Hub', subtitle }: HeaderProps) {
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

        {/* Notification Bell */}
        <button
          type="button"
          aria-label="Notifications"
          className="p-2 rounded-lg bg-slate-800/60 text-slate-300 hover:text-white hover:bg-slate-800 transition"
        >
          <Bell className="w-4 h-4" />
        </button>

        {/* Admin Profile */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-md">
            AD
          </div>
          <div className="hidden md:block text-left text-xs">
            <div className="font-semibold text-slate-200">Admin User</div>
            <div className="text-[10px] text-slate-400">Super Admin</div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
