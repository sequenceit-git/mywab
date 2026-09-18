'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { NavProvider, useNav } from '@/components/NavContext';

function AppShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';
  const { isMobileOpen, closeMobile } = useNav();

  if (isLoginPage) {
    return (
      <div className="flex-1 min-h-screen w-full flex flex-col bg-dark-950">
        {children}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen antialiased w-full relative overflow-x-hidden bg-dark-950">
      {/* Desktop Sticky Sidebar */}
      <Sidebar isMobile={false} />

      {/* Mobile Drawer (Slide-out) */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop Blur Overlay */}
          <div
            onClick={closeMobile}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-fade-in"
          />

          {/* Drawer Panel */}
          <div className="relative z-10 w-72 h-full flex flex-col animate-slide-right">
            <Sidebar isMobile={true} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-b from-dark-900 via-dark-950 to-black pb-16 lg:pb-0">
        {children}
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NavProvider>
        <AppShellContent>{children}</AppShellContent>
      </NavProvider>
    </AuthProvider>
  );
}
