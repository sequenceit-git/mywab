'use client';

import React from 'react';
import { Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { TelegramIcon } from '@/components/BrandIcons';
import { SystemStatus } from '../types';

interface TelegramConfigCardProps {
  status: SystemStatus | null;
  tgWebhookLoading: boolean;
  tgWebhookMsg: { success: boolean; message: string } | null;
  onRegisterTelegramWebhook: () => void;
}

export const TelegramConfigCard: React.FC<TelegramConfigCardProps> = ({
  status,
  tgWebhookLoading,
  tgWebhookMsg,
  onRegisterTelegramWebhook
}) => {
  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-dark-900/90 border border-slate-800/80 space-y-4 shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-telegram-500/10 text-telegram-500 border border-telegram-500/20 shrink-0">
            <TelegramIcon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">Telegram Worker Bot</h4>
            <p className="text-[11px] text-slate-400">Order Dispatch & Atomic Claim Engine</p>
          </div>
        </div>
        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-telegram-500/10 text-telegram-500 border border-telegram-500/20 shrink-0">
          {status?.telegram?.isConfigured ? 'Active' : 'Setup Required'}
        </span>
      </div>

      <div className="space-y-2.5 text-xs">
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/60 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Worker Group ID:</span>
            <span className="font-mono text-slate-200 font-bold">{status?.telegram?.workerGroupId || 'Not configured'}</span>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-slate-400">Bot Token:</span>
            <span className="font-mono text-slate-400 text-[11px]">{status?.telegram?.botTokenMasked || 'Not configured'}</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-slate-300 text-xs space-y-1">
          <div className="text-emerald-400 font-bold flex items-center gap-1.5 text-[11px]">
            <span>🟢 ZiniPay Auto-Payment Integration</span>
          </div>
          <p className="text-[11px] text-slate-400">
            When ZiniPay gateway receives payment, manual fulfillment orders (like PUBG QR login or manual queues) are automatically pushed to the Telegram Worker Group with an unmistakable <b>[AUTO-PAID]</b> badge and verified invoice.
          </p>
        </div>

        {tgWebhookMsg && (
          <div
            className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
              tgWebhookMsg.success
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
            }`}
          >
            {tgWebhookMsg.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>{tgWebhookMsg.message}</span>
          </div>
        )}

        {/* 1-Click Telegram Webhook Auto-Registration */}
        <button
          onClick={onRegisterTelegramWebhook}
          disabled={tgWebhookLoading || !status?.telegram?.isConfigured}
          className="w-full py-2.5 px-4 rounded-xl bg-telegram-500/15 hover:bg-telegram-500/25 border border-telegram-500/30 text-telegram-500 font-bold text-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {tgWebhookLoading ? (
            <span>Registering webhook with Telegram...</span>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>Auto-Register Telegram Webhook (1-Click)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
