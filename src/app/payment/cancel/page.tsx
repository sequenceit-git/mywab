'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { XCircle, RefreshCw, ShoppingBag, ArrowLeft } from 'lucide-react';
import { WhatsAppIcon } from '@/components/BrandIcons';

function CancelContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order_id') || searchParams.get('orderId');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-rose-500 selection:text-white">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-lg bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        {/* Cancel Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-rose-500/20 border border-rose-500/40 rounded-full flex items-center justify-center text-rose-400 shadow-lg shadow-rose-500/20">
            <XCircle className="w-10 h-10" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            পেমেন্ট সম্পন্ন হয়নি
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            পেমেন্টটি বাতিল বা অসম্পূর্ণ রয়েছে। কোনো টাকা কাটা হলে তা স্বয়ংক্রিয়ভাবে রিফান্ড হয়ে যাবে।
          </p>
        </div>

        {/* Order Ref */}
        {orderId && (
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 mb-6 text-sm text-center">
            <span className="text-slate-400">অর্ডার রেফারেন্স: </span>
            <span className="font-mono font-bold text-white">#{orderId}</span>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 mb-6 text-xs text-slate-300 space-y-2">
          <p className="font-semibold text-slate-200">💡 আপনি যা করতে পারেন:</p>
          <ul className="list-disc list-inside space-y-1 text-slate-400">
            <li>হোয়াটসঅ্যাপে ফিরে গিয়ে নতুন পেমেন্ট লিংক চান।</li>
            <li>অন্য পেমেন্ট মেথড (bKash/Nagad/Rocket) দিয়ে আবার চেষ্টা করুন।</li>
            <li>কোনো সমস্যা হলে সরাসরি আমাদের ইনবক্সে জানান।</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <a
            href="https://wa.me"
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/25 transition-all"
          >
            <WhatsAppIcon className="w-5 h-5" />
            হোয়াটসঅ্যাপে চ্যাট চালু করুন
          </a>

          <a
            href="/"
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
            হোমপেজ / শপ
          </a>
        </div>
      </div>
    </div>
  );
}

export default function PaymentCancelPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">লোড হচ্ছে...</div>}>
      <CancelContent />
    </Suspense>
  );
}
