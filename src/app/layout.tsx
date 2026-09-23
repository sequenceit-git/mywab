import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'WapBusiness - AI WhatsApp Commerce & Telegram Worker Dispatch Hub',
  description: 'AI-powered WhatsApp customer support, automated order creation, and Telegram worker dispatching platform with MongoDB Atlas & OpenAI.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-dark-950 text-slate-100 min-h-screen antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
