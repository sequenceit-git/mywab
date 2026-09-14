'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { AuthProvider } from '@/lib/auth/AuthContext';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return (
      <AuthProvider>
        <div className="flex-1 min-h-screen w-full flex flex-col bg-dark-950">
          {children}
        </div>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <div className="flex min-h-screen antialiased w-full">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-b from-dark-900 via-dark-950 to-black">
          {children}
        </div>
      </div>
    </AuthProvider>
  );
}
