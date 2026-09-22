'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Clock, ArrowRight, ShoppingBag, ShieldCheck, Sparkles } from 'lucide-react';
import { WhatsAppIcon } from '@/components/BrandIcons';

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order_id') || searchParams.get('orderId');
  const invoiceId = searchParams.get('invoice_id') || searchParams.get('invoiceId');

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkStatus() {
      try {
        if (orderId) {
          const res = await fetch(`/api/orders/${orderId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.order && isMounted) {
              setOrder(data.order);
              setLoading(false);
              return;
            }
          }
        }

        // If orderId didn't return or invoiceId was provided, trigger a verification check
        if (invoiceId) {
          const res = await fetch(`/api/system/zinipay?action=VERIFY&invoiceId=${encodeURIComponent(invoiceId)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && isMounted) {
              // Refresh order if possible
              if (orderId) {
                const oRes = await fetch(`/api/orders/${orderId}`);
                if (oRes.ok) {
                  const oData = await oRes.json();
                  if (oData.order) setOrder(oData.order);
                }
              }
            }
          }
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Status check error');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    checkStatus();
    // Poll every 3 seconds for 15 seconds to catch instantaneous auto-fulfillment
    const interval = setInterval(checkStatus, 3000);
    const timeout = setTimeout(() => clearInterval(interval), 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [orderId, invoiceId]);

  const isDelivered = order?.status === 'DELIVERED';
  const isProcessing = order?.status === 'PROCESSING' || order?.status === 'CLAIMED';
  const amount = order?.total_amount;
  const productName = order?.items?.[0]?.product_name;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-emerald-500 selection:text-white">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-lg bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-20 h-20 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20 animate-pulse">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 p-1.5 rounded-full shadow">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-3">
            <ShieldCheck className="w-3.5 h-3.5" /> পেমেন্ট সফলভাবে যাচাইকৃত
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            পেমেন্ট সফল হয়েছে!
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            আপনার পেমেন্ট সফলভাবে গ্রহণ করা হয়েছে এবং অর্ডারটি প্রসেস হচ্ছে।
          </p>
        </div>

        {/* Order Details Card */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 sm:p-5 mb-6 space-y-3 text-sm">
          {orderId && (
            <div className="flex justify-between items-center pb-2 border-b border-slate-800/60">
              <span className="text-slate-400">অর্ডার আইডি</span>
              <span className="font-mono font-bold text-white">#{orderId}</span>
            </div>
          )}

          {productName && (
            <div className="flex justify-between items-center pb-2 border-b border-slate-800/60">
              <span className="text-slate-400">প্যাকেজ / সার্ভিস</span>
              <span className="font-semibold text-slate-200">{productName}</span>
            </div>
          )}

          {amount && (
            <div className="flex justify-between items-center pb-2 border-b border-slate-800/60">
              <span className="text-slate-400">পরিশোধিত মূল্য</span>
              <span className="font-bold text-emerald-400 text-base">৳{amount} Tk</span>
            </div>
          )}

          <div className="flex justify-between items-center pt-1">
            <span className="text-slate-400">অর্ডার স্ট্যাটাস</span>
            <div className="flex items-center gap-1.5">
              {isDelivered ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" /> ডেলিভারি সম্পন্ন
                </span>
              ) : isProcessing ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  <Clock className="w-3 h-3 animate-spin" /> প্রসেসিং চলছে
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <Clock className="w-3 h-3" /> ডেলিভারি কিউতে আছে
                </span>
              )}
            </div>
          </div>
        </div>

        {/* WhatsApp Notification Note */}
        <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-3.5 mb-6 text-xs text-emerald-300/90 leading-relaxed flex items-start gap-2.5">
          <WhatsAppIcon className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
          <span>
            আপনার হোয়াটসঅ্যাপে অর্ডারের কনফার্মেশন ও ডেলিভারি বিস্তারিত মেসেজে পাঠানো হয়েছে।
          </span>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <a
            href="https://wa.me"
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/25 transition-all transform active:scale-[0.99]"
          >
            <WhatsAppIcon className="w-5 h-5" />
            হোয়াটসঅ্যাপে ফিরে যান
          </a>

          <a
            href="/"
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
            হোমপেজ / ড্যাশবোর্ড
          </a>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <Clock className="w-6 h-6 animate-spin mr-2" /> পেমেন্ট যাচাই হচ্ছে...
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
