'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import {
  Database,
  Sparkles,
  MessageSquare,
  Bot,
  Key,
  CheckCircle2,
  AlertCircle,
  Copy,
  RefreshCw,
  Globe,
  Server,
  ShieldCheck,
  Send,
  ExternalLink
} from 'lucide-react';

interface SystemStatus {
  timestamp: string;
  app: {
    domain: string;
    url: string;
    nodeEnv: string;
  };
  supabase: {
    isConfigured: boolean;
    connected: boolean;
    url: string;
    publishableKeyMasked: string;
    serviceRoleKeyMasked: string;
    stats: {
      ordersCount: number;
      workersCount: number;
      conversationsCount: number;
      faqsCount: number;
    };
  };
  openai: {
    isConfigured: boolean;
    model: string;
    apiKeyMasked: string;
  };
  whatsapp: {
    isConfigured: boolean;
    phoneNumberId: string;
    verifyToken: string;
    accessTokenMasked: string;
    webhookUrl: string;
  };
  telegram: {
    isConfigured: boolean;
    workerGroupId: string;
    botTokenMasked: string;
    webhookUrl: string;
  };
  admin: {
    email: string;
  };
}

export default function ConfigPage() {
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [tgWebhookLoading, setTgWebhookLoading] = useState(false);
  const [tgWebhookMsg, setTgWebhookMsg] = useState<{ success: boolean; message: string } | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/system/status', {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (data.success) {
          setStatus(data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch system status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchStatus();
  }, []);

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleRegisterTelegramWebhook = async () => {
    setTgWebhookLoading(true);
    setTgWebhookMsg(null);
    try {
      const res = await fetch('/api/system/telegram-webhook', {
        method: 'POST',
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (data.success) {
          setTgWebhookMsg({
            success: true,
            message: 'Telegram Webhook registered successfully with Telegram Bot API!'
          });
        } else {
          setTgWebhookMsg({
            success: false,
            message: data.telegramResponse?.description || data.error || 'Failed to register webhook'
          });
        }
      } else {
        setTgWebhookMsg({
          success: false,
          message: 'Server returned non-JSON response'
        });
      }
    } catch (e) {
      setTgWebhookMsg({
        success: false,
        message: 'Network error registering webhook'
      });
    } finally {
      setTgWebhookLoading(false);
    }
  };

  const [waTestLoading, setWaTestLoading] = useState(false);
  const [waTestMsg, setWaTestMsg] = useState<{ success: boolean; message: string } | null>(null);

  const handleSendWhatsAppTest = async () => {
    setWaTestLoading(true);
    setWaTestMsg(null);
    try {
      const res = await fetch('/api/system/whatsapp-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ phone: '8801705785272' })
      });
      if (res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (data.success) {
          setWaTestMsg({
            success: true,
            message: 'Test message delivered to +8801705785272 and WABA subscription linked!'
          });
        } else {
          setWaTestMsg({
            success: false,
            message: data.results?.testMessage?.error || data.error || 'Failed to deliver message'
          });
        }
      } else {
        setWaTestMsg({
          success: false,
          message: 'Non-JSON response from server'
        });
      }
    } catch (e) {
      setWaTestMsg({
        success: false,
        message: 'Network error sending test message'
      });
    } finally {
      setWaTestLoading(false);
    }
  };

  // Safe client-side derived values
  const currentDomain = status?.app.domain || (mounted && typeof window !== 'undefined' ? window.location.host : 'Loading...');
  const currentWhatsAppWebhook = status?.whatsapp.webhookUrl || (mounted && typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/whatsapp` : '');

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Live System Diagnostics & Configuration"
        subtitle="Real-time status of database connections, AI engines, and external API webhooks"
      />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Top Overview Cards */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-dark-900/90 border border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white shadow-md">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">Production Status</h3>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Online</span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Host: <span suppressHydrationWarning className="text-slate-200 font-semibold">{currentDomain}</span>
              </p>
            </div>
          </div>

          <button
            onClick={fetchStatus}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700/50 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Diagnostics</span>
          </button>
        </div>

        {/* 4 Connected Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 1. Supabase Database Card */}
          <div className="p-6 rounded-2xl bg-dark-900/90 border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Supabase PostgreSQL</h4>
                  <p className="text-[11px] text-slate-400">Database, RLS & Atomic Locking</p>
                </div>
              </div>
              <span
                className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                  status?.supabase.connected
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                {status?.supabase.connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/60 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Database URL:</span>
                <span className="font-mono text-slate-200 text-[11px] truncate max-w-[240px]">
                  {status?.supabase.url}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Service Role Key:</span>
                <span className="font-mono text-slate-400 text-[11px]">
                  {status?.supabase.serviceRoleKeyMasked}
                </span>
              </div>
            </div>

            {/* Real Database Table Stats */}
            <div className="pt-2 border-t border-slate-800/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">Live Table Row Counts</span>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/40">
                  <div className="text-base font-extrabold text-white">{status?.supabase.stats.faqsCount ?? 0}</div>
                  <div className="text-[10px] text-slate-400">FAQs / Q&A</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/40">
                  <div className="text-base font-extrabold text-brand-400">{status?.supabase.stats.ordersCount ?? 0}</div>
                  <div className="text-[10px] text-slate-400">Orders</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/40">
                  <div className="text-base font-extrabold text-telegram-500">{status?.supabase.stats.workersCount ?? 0}</div>
                  <div className="text-[10px] text-slate-400">Workers</div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. OpenAI & LangChain Card */}
          <div className="p-6 rounded-2xl bg-dark-900/90 border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">OpenAI & LangChain Agent</h4>
                  <p className="text-[11px] text-slate-400">Tool Calling & Conversational AI</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                {status?.openai.isConfigured ? 'Ready' : 'Pending Key'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/60 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Active Model:</span>
                <span className="font-mono text-indigo-300 font-bold">{status?.openai.model || 'gpt-5-nano'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">OpenAI API Key:</span>
                <span className="font-mono text-slate-400 text-[11px]">{status?.openai.apiKeyMasked}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/60 space-y-1.5 text-xs text-slate-400">
              <div className="flex items-center justify-between text-[11px]">
                <span>Registered Agent Tools:</span>
                <span className="font-semibold text-slate-200">search_catalog, get_faq, create_order, track_order</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span>Language Support:</span>
                <span className="font-semibold text-emerald-400">Bangla (বাংলা) & English (Bilingual)</span>
              </div>
            </div>
          </div>

          {/* 3. WhatsApp Cloud API Webhook Card */}
          <div className="p-6 rounded-2xl bg-dark-900/90 border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">WhatsApp Business Cloud API</h4>
                  <p className="text-[11px] text-slate-400">Meta Developer Webhook Gateway</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
                {status?.whatsapp.isConfigured ? 'Configured' : 'Setup Required'}
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/60 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Callback URL:</span>
                  <button
                    onClick={() => handleCopy(currentWhatsAppWebhook, 'wa_url')}
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
                    onClick={() => handleCopy(status?.whatsapp.verifyToken || '', 'wa_token')}
                    className="text-[11px] font-mono text-brand-400 hover:text-brand-300 flex items-center gap-1"
                  >
                    <span>{copiedKey === 'wa_token' ? 'Copied!' : 'Copy Token'}</span>
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                <code className="block text-[11px] font-mono text-brand-400 font-bold">
                  {status?.whatsapp.verifyToken || 'verify_token'}
                </code>
              </div>

              <div className="flex items-center justify-between px-1 text-slate-400 text-[11px]">
                <span>Phone Number ID:</span>
                <span className="font-mono text-slate-200">{status?.whatsapp.phoneNumberId}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/50 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Webhook Subscribed Field:</span>
                  <span className="font-mono text-brand-400 font-semibold">messages</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Token Permissions:</span>
                  <span className="font-mono text-slate-300">whatsapp_business_messaging, management</span>
                </div>
              </div>

              {waTestMsg && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                    waTestMsg.success
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                  }`}
                >
                  {waTestMsg.success ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                  <span className="break-all">{waTestMsg.message}</span>
                </div>
              )}

              <button
                onClick={handleSendWhatsAppTest}
                disabled={waTestLoading || !status?.whatsapp.isConfigured}
                className="w-full py-2.5 px-4 rounded-xl bg-brand-500/15 hover:bg-brand-500/25 border border-brand-500/30 text-brand-400 font-bold text-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {waTestLoading ? (
                  <span>Delivering Test WhatsApp Message...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Test Message to +8801705785272 & Link WABA</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 4. Telegram Worker Bot Card */}
          <div className="p-6 rounded-2xl bg-dark-900/90 border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-telegram-500/10 text-telegram-500 border border-telegram-500/20">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Telegram Worker Bot</h4>
                  <p className="text-[11px] text-slate-400">Order Dispatch & Atomic Claim Engine</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-telegram-500/10 text-telegram-500 border border-telegram-500/20">
                {status?.telegram.isConfigured ? 'Active' : 'Setup Required'}
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/60 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Worker Group ID:</span>
                  <span className="font-mono text-slate-200 font-bold">{status?.telegram.workerGroupId}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-400">Bot Token:</span>
                  <span className="font-mono text-slate-400 text-[11px]">{status?.telegram.botTokenMasked}</span>
                </div>
              </div>

              {tgWebhookMsg && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                    tgWebhookMsg.success
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                  }`}
                >
                  {tgWebhookMsg.success ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                  <span>{tgWebhookMsg.message}</span>
                </div>
              )}

              {/* 1-Click Telegram Webhook Auto-Registration */}
              <button
                onClick={handleRegisterTelegramWebhook}
                disabled={tgWebhookLoading || !status?.telegram.isConfigured}
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
        </div>
      </main>
    </div>
  );
}
