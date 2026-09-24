'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  MessageSquare,
  ShoppingBag,
  BadgePercent,
  Trophy,
  Users
} from 'lucide-react';

const mobileNavItems = [
  { name: 'Overview', href: '/', icon: LayoutDashboard },
  { name: 'Chat', href: '/chat', icon: MessageSquare, badge: 'Live' },
  { name: 'Orders', href: '/orders', icon: ShoppingBag, badge: 'Live' },
  { name: 'Pricing', href: '/pricing', icon: BadgePercent },
  { name: 'Workers', href: '/workers', icon: Users },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-dark-900/95 backdrop-blur-xl border-t border-slate-800/80 px-2 py-1.5 flex items-center justify-around shadow-2xl safe-area-bottom">
      {mobileNavItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;

        return (
          <Link
            key={item.name}
            href={item.href}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[10px] font-semibold transition-all relative ${
              isActive
                ? 'text-brand-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <Icon className={`w-4 h-4 ${isActive ? 'text-brand-400 scale-110' : 'text-slate-400'}`} />
              {item.badge && (
                <span className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              )}
            </div>
            <span className="mt-1 leading-tight">{item.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
