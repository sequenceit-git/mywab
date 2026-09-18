'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  LayoutDashboard,
  ShoppingBag,
  MessageSquare,
  Users,
  Package,
  Database,
  Bot,
  Trophy,
  ShieldCheck,
  LogOut
} from 'lucide-react';

const navigation = [
  { name: 'Overview', href: '/', icon: LayoutDashboard },
  { name: 'Live Orders', href: '/orders', icon: ShoppingBag, badge: 'Live' },
  { name: 'Customers & Leaderboard', href: '/users', icon: Trophy },
  { name: 'Telegram Workers', href: '/workers', icon: Users },
  { name: 'Supabase & Config', href: '/config', icon: Database },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 bg-dark-900 border-r border-slate-800 flex flex-col h-screen sticky top-0">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
          <Bot className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="font-bold text-lg text-white tracking-tight">WapBusiness</h1>
            <span className="text-[10px] uppercase font-extrabold bg-brand-500/20 text-brand-400 px-1.5 py-0.5 rounded border border-brand-500/30">AI</span>
          </div>
          <p className="text-xs text-slate-400">WhatsApp & Telegram Hub</p>
        </div>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Management
        </div>

        {navigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-brand-400' : 'text-slate-400'}`} />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Connected Channels & User Footer */}
      <div className="p-3 border-t border-slate-800 space-y-2">
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-400 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse"></span>
              WhatsApp
            </span>
            <span className="flex items-center gap-1.5 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-telegram-500"></span>
              Telegram
            </span>
            <span className="flex items-center gap-1.5 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Supabase
            </span>
          </div>
        </div>

        {/* User profile & Logout */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/60">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-brand-500/20 text-brand-400 font-bold text-xs flex items-center justify-center shrink-0 border border-brand-500/30">
              {user?.name?.[0] || 'A'}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-semibold text-slate-200 truncate">{user?.name || 'Admin'}</div>
              <div className="text-[10px] text-slate-400 truncate">{user?.email || 'admin@sequenceit.software'}</div>
            </div>
          </div>
          <button
            onClick={logout}
            title="Log out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition shrink-0 ml-1"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
