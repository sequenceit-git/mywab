'use client';

import React from 'react';
import {
  CreditCard,
  Copy,
  ExternalLink,
  RefreshCw
} from 'lucide-react';

interface ZiniPayConfigCardProps {
  zinipayConfigured: boolean;
  zinipayAutoPayment: boolean;
  zinipayToggling: boolean;
  zinipayToggleMsg: string | null;
  zinipayWebhookUrl: string;
  zinipayRedirectUrl: string;
  appUrl?: string;
  zinipayTestLoading: boolean;
  zinipayTestResult: { status?: boolean; payment_url?: string; error?: string } | null;
  onToggleZinipay: () => void;
  onTestCreateInvoice: () => void;
  onCopy: (text: string, label: string) => void;
}

export const ZiniPayConfigCard: React.FC<ZiniPayConfigCardProps> = ({
  zinipayConfigured,
  zinipayAutoPayment,
  zinipayToggling,
  zinipayToggleMsg,
  zinipayWebhookUrl,
  zinipayRedirectUrl,
  appUrl,
  zinipayTestLoading,
  zinipayTestResult,
  onToggleZinipay,
  onTestCreateInvoice,
  onCopy
}) => {
  const effectiveWebhook = zinipayWebhookUrl || `${appUrl}/api/webhooks/zinipay`;
  const effectiveRedirect = zinipayRedirectUrl || `${appUrl}/payment/success`;

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-dark-900/90 border border-slate-800/80 space-y-4 shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">ZiniPay Gateway (Auto Payment)</h4>
            <p className="text-[11px] text-slate-400">bKash, Nagad, Rocket Automated Invoicing & Webhook</p>
          </div>
        </div>
        <span
          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${
            zinipayConfigured
              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}
        >
          {zinipayConfigured ? 'Connected' : 'Key Missing in .env'}
        </span>
      </div>

      {/* ZiniPay Auto-Payment Switch */}
      <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/60 flex items-center justify-between gap-3">
        <div>
          <span className="font-bold text-white text-xs block">Automatic Payment Verification</span>
          <span className="text-[11px] text-slate-400">
            {zinipayAutoPayment
              ? 'Generates 1-click checkout links and auto-verifies payments'
              : 'Auto-payment paused (falls back to manual personal numbers)'}
          </span>
        </div>
        <button
          onClick={onToggleZinipay}
          disabled={zinipayToggling || !zinipayConfigured}
          className={`py-1.5 px-3 rounded-xl font-bold text-xs transition flex items-center gap-1.5 shrink-0 ${
            zinipayAutoPayment
              ? 'bg-cyan-500 hover:bg-cyan-600 text-slate-950'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          } disabled:opacity-50`}
        >
          {zinipayToggling ? (
            <span>Saving...</span>
          ) : (
            <>
              <CreditCard className="w-3.5 h-3.5" />
              <span>{zinipayAutoPayment ? 'Active (ON)' : 'Disabled (OFF)'}</span>
            </>
          )}
        </button>
      </div>

      {zinipayToggleMsg && (
        <div className="p-2 rounded-xl text-xs bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
          {zinipayToggleMsg}
        </div>
      )}

      {/* Webhook & Redirect URLs */}
      <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/60 space-y-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-400 shrink-0">Webhook URL:</span>
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="font-mono text-cyan-300 text-[11px] truncate">{effectiveWebhook}</span>
            <button
              onClick={() => onCopy(effectiveWebhook, 'zinipay_webhook')}
              className="p-1 hover:text-white transition shrink-0"
              title="Copy Webhook URL"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/40">
          <span className="text-slate-400 shrink-0">Success Redirect:</span>
          <span className="font-mono text-slate-400 text-[11px] truncate">{effectiveRedirect}</span>
        </div>
      </div>

      {/* Test Invoice Trigger */}
      <div className="pt-1">
        <button
          onClick={onTestCreateInvoice}
          disabled={zinipayTestLoading || !zinipayConfigured}
          className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700/60 transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {zinipayTestLoading ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Creating Test Invoice on ZiniPay...</span>
            </>
          ) : (
            <>
              <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
              <span>Create Test Sandbox Invoice (৳10)</span>
            </>
          )}
        </button>

        {zinipayTestResult && (
          <div className="mt-2.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-1">
            {zinipayTestResult.status && zinipayTestResult.payment_url ? (
              <div>
                <span className="text-emerald-400 font-bold block">Invoice Created Successfully:</span>
                <a
                  href={zinipayTestResult.payment_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400 underline font-mono text-[11px] break-all inline-flex items-center gap-1 mt-1"
                >
                  {zinipayTestResult.payment_url}
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
            ) : (
              <span className="text-rose-400">
                Error: {zinipayTestResult.error || 'Failed to create invoice'}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
