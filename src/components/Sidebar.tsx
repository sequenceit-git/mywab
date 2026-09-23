'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { useNav } from '@/components/NavContext';
import { BrandLogo, WhatsAppIcon, TelegramIcon, MongoDbIcon } from '@/components/BrandIcons';
import {
  LayoutDashboard,
  ShoppingBag,
  Users,
  Database,
  Trophy,
  BadgePercent,
  LogOut,
  X
} from 'lucide-react';

export const navigation = [
  { name: 'Overview', href: '/', icon: LayoutDashboard },
  { name: 'Live Orders', href: '/orders', icon: ShoppingBag, badge: 'Live' },
  { name: 'Pricing & Profit', href: '/pricing', icon: BadgePercent },
  { name: 'Leaderboard', href: '/users', icon: Trophy },
  { name: 'Workers', href: '/workers', icon: Users },
  { name: 'Config & DB', href: '/config', icon: Database },
];

export function Sidebar({ isMobile = false }: { isMobile?: boolean }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { closeMobile } = useNav();

  return (
    <aside
      className={`${
        isMobile
          ? 'w-72 bg-dark-900 border-r border-slate-800 flex flex-col h-full shadow-2xl'
          : 'hidden lg:flex w-64 bg-dark-900/95 backdrop-blur-xl border-r border-slate-800 flex-col h-screen sticky top-0 shrink-0 z-30'
      }`}
    >
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <Link href="/" onClick={isMobile ? closeMobile : undefined} className="flex items-center gap-3 group">
          <BrandLogo className="w-9 h-9" />
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-extrabold text-base text-white tracking-tight group-hover:text-brand-300 transition">
                WapBusiness
              </h1>
              <span className="text-[9px] uppercase font-black bg-brand-500/20 text-brand-400 px-1.5 py-0.5 rounded border border-brand-500/30">
                AI
              </span>
            </div>
            <p className="text-[11px] text-slate-400">WhatsApp & TG Commerce Hub</p>
          </div>
        </Link>

        {isMobile && (
          <button
            onClick={closeMobile}
            className="p-1.5 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Management
        </div>

        {navigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={isMobile ? closeMobile : undefined}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-brand-500/20 to-indigo-500/10 text-brand-400 border border-brand-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-brand-400' : 'text-slate-400'}`} />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Connected Channels & User Footer */}
      <div className="p-3 border-t border-slate-800/80 space-y-2">
        <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-400 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-400">
              <WhatsAppIcon className="w-3.5 h-3.5" />
              WhatsApp
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-telegram-500">
              <TelegramIcon className="w-3.5 h-3.5" />
              Telegram
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-400">
              <MongoDbIcon className="w-3.5 h-3.5" />
              MongoDB
            </span>
          </div>
        </div>

        {/* User Profile & Logout */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/50 border border-slate-800/60">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
              {user?.name?.[0] || 'A'}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-semibold text-slate-200 truncate">{user?.name || 'Admin'}</div>
              <div className="text-[10px] text-slate-400 truncate max-w-[120px]">{user?.email || 'admin@sequenceit.software'}</div>
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
