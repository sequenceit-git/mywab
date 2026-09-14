import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'WapBusiness - AI WhatsApp Commerce & Telegram Worker Dispatch Hub',
  description: 'AI-powered WhatsApp customer support, automated order creation, and Telegram worker dispatching platform with Supabase & OpenAI.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-dark-950 text-slate-100 flex min-h-screen antialiased">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-b from-dark-900 via-dark-950 to-black">
          {children}
        </div>
      </body>
    </html>
  );
}
