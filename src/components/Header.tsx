'use client';

import React from 'react';
import { RefreshCw, LogOut, Menu } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useNav } from '@/components/NavContext';
import { BrandLogo } from '@/components/BrandIcons';

export interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export function Header({ title = 'Operations Hub', subtitle }: HeaderProps) {
  const { user, logout } = useAuth();
  const { toggleMobile } = useNav();

  const userInitials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'AD';

  return (
    <header className="h-16 border-b border-slate-800/80 bg-dark-900/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3 overflow-hidden">
        {/* Mobile Drawer Trigger */}
        <button
          onClick={toggleMobile}
          aria-label="Toggle navigation menu"
          className="lg:hidden p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Mobile Brand Logo Icon */}
        <div className="lg:hidden shrink-0">
          <BrandLogo className="w-7 h-7" />
        </div>

        <div className="overflow-hidden">
          <h2 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">{title}</h2>
          {subtitle && (
            <p className="hidden sm:block text-[11px] text-slate-400 truncate max-w-xl">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Live sync pulse badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-[11px] text-slate-300">
          <RefreshCw className="w-3 h-3 text-brand-400 animate-spin" style={{ animationDuration: '8s' }} />
          <span className="hidden md:inline">Real-time Sync</span>
        </div>

        {/* Admin Profile & Logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-[11px] sm:text-xs font-bold text-white shadow-md shrink-0">
            {userInitials}
          </div>
          <div className="hidden xl:block text-left text-xs">
            <div className="font-semibold text-slate-200">{user?.name || 'Admin User'}</div>
            <div className="text-[10px] text-slate-400 truncate max-w-[120px]">{user?.email || 'admin@sequenceit.software'}</div>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
