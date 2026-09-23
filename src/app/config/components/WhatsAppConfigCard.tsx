'use client';

import React from 'react';
import { Copy, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import { WhatsAppIcon } from '@/components/BrandIcons';
import { SystemStatus } from '../types';

interface WhatsAppConfigCardProps {
  status: SystemStatus | null;
  currentWhatsAppWebhook: string;
  copiedKey: string | null;
  waTestLoading: boolean;
  waTestMsg: { success: boolean; message: string } | null;
  onCopy: (text: string, label: string) => void;
  onSendWhatsAppTest: () => void;
}

export const WhatsAppConfigCard: React.FC<WhatsAppConfigCardProps> = ({
  status,
  currentWhatsAppWebhook,
  copiedKey,
  waTestLoading,
  waTestMsg,
  onCopy,
  onSendWhatsAppTest
}) => {
  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-dark-900/90 border border-slate-800/80 space-y-4 shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
            <WhatsAppIcon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">WhatsApp Business Cloud API</h4>
            <p className="text-[11px] text-slate-400">Meta Developer Webhook Gateway</p>
          </div>
        </div>
        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 shrink-0">
          {status?.whatsapp?.isConfigured ? 'Configured' : 'Setup Required'}
        </span>
      </div>

      <div className="space-y-2.5 text-xs">
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/60 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Callback URL:</span>
            <button
              onClick={() => onCopy(currentWhatsAppWebhook, 'wa_url')}
              className="text-[11px] font-mono text-brand-400 hover:text-brand-300 flex items-center gap-1"
            >
              <span>{copiedKey === 'wa_url' ? 'Copied!' : 'Copy URL'}</span>
              <Copy className="w-3 h-3" />
            </button>
          </div>
          <code suppressHydrationWarning className="block text-[11px] font-mono text-slate-200 break-all">
            {currentWhatsAppWebhook}
          </code>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/60 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Verify Token:</span>
            <button
              onClick={() => onCopy(status?.whatsapp?.verifyToken || '', 'wa_token')}
              className="text-[11px] font-mono text-brand-400 hover:text-brand-300 flex items-center gap-1"
            >
              <span>{copiedKey === 'wa_token' ? 'Copied!' : 'Copy Token'}</span>
              <Copy className="w-3 h-3" />
            </button>
          </div>
          <code className="block text-[11px] font-mono text-brand-400 font-bold">
            {status?.whatsapp?.verifyToken || 'verify_token'}
          </code>
        </div>

        {waTestMsg && (
          <div
            className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
              waTestMsg.success
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
            }`}
          >
            {waTestMsg.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span className="break-all">{waTestMsg.message}</span>
          </div>
        )}

        <button
          onClick={onSendWhatsAppTest}
          disabled={waTestLoading || !status?.whatsapp?.isConfigured}
          className="w-full py-2.5 px-4 rounded-xl bg-brand-500/15 hover:bg-brand-500/25 border border-brand-500/30 text-brand-400 font-bold text-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {waTestLoading ? (
            <span>Delivering Test WhatsApp Message...</span>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>Send Test Message to +8801705785272</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
