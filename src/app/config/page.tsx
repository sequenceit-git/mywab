'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import {
  CheckCircle2,
  AlertCircle,
  Copy,
  RefreshCw,
  Server,
  Send,
  Zap,
  ToggleLeft,
  ToggleRight,
  Search,
  Layers,
  Package,
  ShieldCheck,
  Bot,
  CreditCard,
  ExternalLink
} from 'lucide-react';
import { SupabaseIcon, WhatsAppIcon, TelegramIcon, PubgUidIcon, BkashIcon, NagadIcon } from '@/components/BrandIcons';

interface SystemStatus {
  timestamp?: string;
  app?: {
    domain?: string;
    url?: string;
    nodeEnv?: string;
  };
  supabase?: {
    isConfigured?: boolean;
    connected?: boolean;
    url?: string;
    publishableKeyMasked?: string;
    serviceRoleKeyMasked?: string;
    stats?: {
      ordersCount?: number;
      workersCount?: number;
      conversationsCount?: number;
      faqsCount?: number;
    };
  };
  whatsapp?: {
    isConfigured?: boolean;
    phoneNumberId?: string;
    verifyToken?: string;
    accessTokenMasked?: string;
    webhookUrl?: string;
  };
  telegram?: {
    isConfigured?: boolean;
    workerGroupId?: string;
    botTokenMasked?: string;
    webhookUrl?: string;
  };
  admin?: {
    email?: string;
  };
}

export default function ConfigPage() {
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [tgWebhookLoading, setTgWebhookLoading] = useState(false);
  const [tgWebhookMsg, setTgWebhookMsg] = useState<{ success: boolean; message: string } | null>(null);

  // Kokos Activator API State
  const [kokosConfigured, setKokosConfigured] = useState<boolean>(false);
  const [kokosAutoFulfill, setKokosAutoFulfill] = useState<boolean>(false);
  const [kokosInventory, setKokosInventory] = useState<Record<string, number> | null>(null);
  const [kokosInvLoading, setKokosInvLoading] = useState<boolean>(false);
  const [kokosToggling, setKokosToggling] = useState<boolean>(false);
  const [kokosLookupUid, setKokosLookupUid] = useState<string>('');
  const [kokosLookupLoading, setKokosLookupLoading] = useState<boolean>(false);
  const [kokosLookupResult, setKokosLookupResult] = useState<{ name?: string; error?: string } | null>(null);
  const [kokosToggleMsg, setKokosToggleMsg] = useState<string | null>(null);

  // Pinex Activator API State
  const [pinexConfigured, setPinexConfigured] = useState<boolean>(false);
  const [pinexAutoFulfill, setPinexAutoFulfill] = useState<boolean>(true);
  const [pinexToggling, setPinexToggling] = useState<boolean>(false);
  const [pinexToggleMsg, setPinexToggleMsg] = useState<string | null>(null);

  // ZiniPay Payment Gateway State
  const [zinipayConfigured, setZinipayConfigured] = useState<boolean>(false);
  const [zinipayAutoPayment, setZinipayAutoPayment] = useState<boolean>(true);
  const [zinipayToggling, setZinipayToggling] = useState<boolean>(false);
  const [zinipayToggleMsg, setZinipayToggleMsg] = useState<string | null>(null);
  const [zinipayWebhookUrl, setZinipayWebhookUrl] = useState<string>('');
  const [zinipayRedirectUrl, setZinipayRedirectUrl] = useState<string>('');
  const [zinipayTestLoading, setZinipayTestLoading] = useState<boolean>(false);
  const [zinipayTestResult, setZinipayTestResult] = useState<{ status?: boolean; payment_url?: string; error?: string } | null>(null);

  const fetchKokosStatus = async () => {
    try {
      const res = await fetch('/api/system/kokos');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setKokosConfigured(data.configured);
          setKokosAutoFulfill(data.autoFulfillEnabled);
        }
      }
    } catch (e) {
      console.error('Failed to fetch Kokos status:', e);
    }
  };

  const fetchPinexStatus = async () => {
    try {
      const res = await fetch('/api/system/pinex');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setPinexConfigured(data.configured);
          setPinexAutoFulfill(data.autoFulfillEnabled);
        }
      }
    } catch (e) {
      console.error('Failed to fetch Pinex status:', e);
    }
  };

  const fetchZinipayStatus = async () => {
    try {
      const res = await fetch('/api/system/zinipay');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setZinipayConfigured(data.configured);
          setZinipayAutoPayment(data.autoPaymentEnabled);
          setZinipayWebhookUrl(data.webhookUrl);
          setZinipayRedirectUrl(data.redirectUrl);
        }
      }
    } catch (e) {
      console.error('Failed to fetch ZiniPay status:', e);
    }
  };

  const handleTogglePinex = async () => {
    setPinexToggling(true);
    setPinexToggleMsg(null);
    try {
      const nextState = !pinexAutoFulfill;
      const res = await fetch('/api/system/pinex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TOGGLE_AUTO_FULFILL',
          enabled: nextState
        })
      });
      const data = await res.json();
      if (data.success) {
        setPinexAutoFulfill(data.autoFulfillEnabled);
        setPinexToggleMsg(data.message);
        setTimeout(() => setPinexToggleMsg(null), 3000);
      }
    } catch (e) {
      console.error('Failed to toggle Pinex auto fulfill:', e);
    } finally {
      setPinexToggling(false);
    }
  };

  const handleToggleZinipay = async () => {
    setZinipayToggling(true);
    setZinipayToggleMsg(null);
    try {
      const nextState = !zinipayAutoPayment;
      const res = await fetch('/api/system/zinipay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TOGGLE_AUTO_PAYMENT',
          enabled: nextState
        })
      });
      const data = await res.json();
      if (data.success) {
        setZinipayAutoPayment(data.autoPaymentEnabled);
        setZinipayToggleMsg(data.message);
        setTimeout(() => setZinipayToggleMsg(null), 3500);
      }
    } catch (e) {
      console.error('Failed to toggle ZiniPay auto payment:', e);
    } finally {
      setZinipayToggling(false);
    }
  };

  const handleTestCreateInvoice = async () => {
    setZinipayTestLoading(true);
    setZinipayTestResult(null);
    try {
      const res = await fetch('/api/system/zinipay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TEST_CREATE_INVOICE',
          amount: 10
        })
      });
      const data = await res.json();
      setZinipayTestResult(data);
    } catch (e: any) {
      setZinipayTestResult({ status: false, error: e.message });
    } finally {
      setZinipayTestLoading(false);
    }
  };

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
      await fetchKokosStatus();
      await fetchPinexStatus();
      await fetchZinipayStatus();
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

  const handleToggleKokos = async () => {
    setKokosToggling(true);
    setKokosToggleMsg(null);
    try {
      const nextState = !kokosAutoFulfill;
      const res = await fetch('/api/system/kokos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TOGGLE_AUTO_FULFILL',
          enabled: nextState
        })
      });
      const data = await res.json();
      if (data.success) {
        setKokosAutoFulfill(data.autoFulfillEnabled);
        setKokosToggleMsg(data.message);
        setTimeout(() => setKokosToggleMsg(null), 4000);
      }
    } catch (e) {
      console.error('Failed to toggle Kokos auto-fulfillment:', e);
    } finally {
      setKokosToggling(false);
    }
  };

  const handleCheckInventory = async () => {
    setKokosInvLoading(true);
    try {
      const res = await fetch('/api/system/kokos?inventory=true');
      const data = await res.json();
      if (data.success && data.inventory) {
        setKokosInventory(data.inventory);
      } else {
        setKokosInventory({});
      }
    } catch (e) {
      console.error('Failed to fetch inventory:', e);
    } finally {
      setKokosInvLoading(false);
    }
  };

  const handleLookupPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kokosLookupUid.trim()) return;
    setKokosLookupLoading(true);
    setKokosLookupResult(null);
    try {
      const res = await fetch('/api/system/kokos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TEST_LOOKUP',
          playerId: kokosLookupUid.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setKokosLookupResult({ name: data.name });
      } else {
        setKokosLookupResult({ error: data.error || 'Player not found' });
      }
    } catch (e) {
      setKokosLookupResult({ error: 'Network lookup error' });
    } finally {
      setKokosLookupLoading(false);
    }
  };

  // Safe client-side derived values
  const currentDomain = status?.app?.domain || (mounted && typeof window !== 'undefined' ? window.location.host : 'Loading...');
  const currentWhatsAppWebhook = status?.whatsapp?.webhookUrl || (mounted && typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/whatsapp` : '');

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-950">
      <Header
        title="Live System Diagnostics & Configuration"
        subtitle="Real-time status of database connections, messaging gateways, external API webhooks, and auto-fulfillment engines"
      />

      <main className="p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-4 sm:space-y-6 pb-20 lg:pb-6">
        {/* Top Overview Cards */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-dark-900/90 border border-slate-800/80 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white shadow-md shrink-0">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">Production Status</h3>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Online</span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5 break-all">
                Host: <span suppressHydrationWarning className="text-slate-200 font-semibold">{currentDomain}</span>
              </p>
            </div>
          </div>

          <button
            onClick={fetchStatus}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700/50 disabled:opacity-50 self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Diagnostics</span>
          </button>
        </div>

        {/* 4 Connected Services Grid (2x2 on desktop) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* 1. Supabase Database Card */}
          <div className="p-5 sm:p-6 rounded-2xl bg-dark-900/90 border border-slate-800/80 space-y-4 shadow-lg">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                  <SupabaseIcon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Supabase PostgreSQL</h4>
                  <p className="text-[11px] text-slate-400">Database, RLS & Atomic Locking</p>
                </div>
              </div>
              <span
                className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0 ${
                  status?.supabase?.connected
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                {status?.supabase?.connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/60 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400 shrink-0">Database URL:</span>
                <span className="font-mono text-slate-200 text-[11px] truncate max-w-[200px] sm:max-w-[240px]">
                  {status?.supabase?.url || 'Not set'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400 shrink-0">Service Role Key:</span>
                <span className="font-mono text-slate-400 text-[11px]">
                  {status?.supabase?.serviceRoleKeyMasked || 'Not Configured'}
                </span>
              </div>
            </div>

            {/* Real Database Table Stats */}
            <div className="pt-2 border-t border-slate-800/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">Live Table Row Counts</span>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/40">
                  <div className="text-base font-extrabold text-white">{status?.supabase?.stats?.faqsCount ?? 0}</div>
                  <div className="text-[10px] text-slate-400">FAQs / Q&A</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/40">
                  <div className="text-base font-extrabold text-brand-400">{status?.supabase?.stats?.ordersCount ?? 0}</div>
                  <div className="text-[10px] text-slate-400">Orders</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/40">
                  <div className="text-base font-extrabold text-telegram-500">{status?.supabase?.stats?.workersCount ?? 0}</div>
                  <div className="text-[10px] text-slate-400">Workers</div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Kokos Activator API Card (PUBG UID Auto-Fulfillment) */}
          <div className="p-5 sm:p-6 rounded-2xl bg-dark-900/90 border border-brand-500/30 space-y-4 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                  <PubgUidIcon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                    <span>Kokos Activator API</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">PUBG UID</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">Instant UC Code Redemption & Auto-Fulfillment</p>
                </div>
              </div>
              <span
                className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0 ${
                  kokosConfigured
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}
              >
                {kokosConfigured ? 'API Key Configured' : 'Missing KOKOS_API_TOKEN'}
              </span>
            </div>

            {/* Auto-Fulfillment Master Toggle Switch */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-brand-400" />
                  <span>PUBG UID Auto-Fulfill Mode</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {kokosAutoFulfill
                    ? '🟢 ON: Orders redeem instantly via Kokos API & notify on WhatsApp'
                    : '🔵 OFF: Orders dispatch to Telegram Worker Bot for manual claims'}
                </p>
              </div>

              <button
                onClick={handleToggleKokos}
                disabled={kokosToggling}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                  kokosAutoFulfill
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-dark-950 shadow-md shadow-emerald-500/20'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
              >
                {kokosAutoFulfill ? (
                  <>
                    <ToggleRight className="w-4 h-4" />
                    <span>ON</span>
                  </>
                ) : (
                  <>
                    <ToggleLeft className="w-4 h-4" />
                    <span>OFF</span>
                  </>
                )}
              </button>
            </div>

            {kokosToggleMsg && (
              <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{kokosToggleMsg}</span>
              </div>
            )}

            {/* Live Kokos Inventory Check */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-slate-400" />
                  <span>Database Code Stock</span>
                </span>
                <button
                  onClick={handleCheckInventory}
                  disabled={kokosInvLoading || !kokosConfigured}
                  className="text-[11px] text-brand-400 hover:underline flex items-center gap-1 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${kokosInvLoading ? 'animate-spin' : ''}`} />
                  <span>{kokosInventory ? 'Refresh Stock' : 'Check Stock'}</span>
                </button>
              </div>

              {kokosInventory && (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1">
                  {['60', '325', '660', '1800', '3850', '8100'].map((uc) => (
                    <div key={uc} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-center">
                      <div className="text-[10px] text-slate-400">{uc} UC</div>
                      <div className={`text-xs font-mono font-bold ${
                        (kokosInventory[uc] || 0) > 0 ? 'text-emerald-400' : 'text-slate-500'
                      }`}>
                        {kokosInventory[uc] ?? 0}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Test Player Character Lookup */}
            <form onSubmit={handleLookupPlayer} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Test Player UID (e.g. 51709255708)"
                  value={kokosLookupUid}
                  onChange={(e) => setKokosLookupUid(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>
              <button
                type="submit"
                disabled={kokosLookupLoading || !kokosConfigured}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold disabled:opacity-50"
              >
                {kokosLookupLoading ? 'Checking...' : 'Verify'}
              </button>
            </form>

            {kokosLookupResult && (
              <div className={`p-2 rounded-xl text-xs flex items-center gap-2 ${
                kokosLookupResult.name
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                  : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
              }`}>
                {kokosLookupResult.name ? (
                  <span>✅ Player In-Game Name: <b className="font-bold text-white">{kokosLookupResult.name}</b></span>
                ) : (
                  <span>❌ {kokosLookupResult.error}</span>
                )}
              </div>
            )}
          </div>

          {/* 3. Pinex API (Free Fire Auto-Fulfillment) */}
          <div className="p-5 sm:p-6 rounded-2xl bg-dark-900/90 border border-slate-800/80 space-y-4 shadow-lg">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Pinex API (Free Fire Auto-Fulfillment)</h4>
                  <p className="text-[11px] text-slate-400">Direct Free Fire Diamonds & Shells Redemption</p>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${
                pinexConfigured
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {pinexConfigured ? 'Connected' : 'Key Missing in .env'}
              </span>
            </div>

            {/* Pinex Auto-Fulfill Switch */}
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/60 flex items-center justify-between gap-3">
              <div>
                <span className="font-bold text-white text-xs block">Free Fire Auto-Fulfillment</span>
                <span className="text-[11px] text-slate-400">
                  {pinexAutoFulfill
                    ? 'Orders are automatically fulfilled via Pinex API without Telegram'
                    : 'Auto-fulfillment is paused'}
                </span>
              </div>
              <button
                onClick={handleTogglePinex}
                disabled={pinexToggling || !pinexConfigured}
                className={`py-1.5 px-3 rounded-xl font-bold text-xs transition flex items-center gap-1.5 shrink-0 ${
                  pinexAutoFulfill
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                } disabled:opacity-50`}
              >
                {pinexToggling ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>{pinexAutoFulfill ? 'Active (ON)' : 'Disabled (OFF)'}</span>
                  </>
                )}
              </button>
            </div>

            {pinexToggleMsg && (
              <div className="p-2 rounded-xl text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300">
                {pinexToggleMsg}
              </div>
            )}

            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/60 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Pinex Endpoint:</span>
                <span className="font-mono text-slate-300 text-[11px]">https://sohan.pinexbot.shop/pinex/brand</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-400">Callback Gateway:</span>
                <span className="font-mono text-slate-400 text-[11px]">/api/system/pinex/callback</span>
              </div>
            </div>
          </div>

          {/* 4. ZiniPay Payment Gateway (Auto-Verification) */}
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
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${
                zinipayConfigured
                  ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
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
                onClick={handleToggleZinipay}
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
                  <span className="font-mono text-cyan-300 text-[11px] truncate">
                    {zinipayWebhookUrl || `${status?.app?.url}/api/webhooks/zinipay`}
                  </span>
                  <button
                    onClick={() => handleCopy(zinipayWebhookUrl || `${status?.app?.url}/api/webhooks/zinipay`, 'zinipay_webhook')}
                    className="p-1 hover:text-white transition shrink-0"
                    title="Copy Webhook URL"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/40">
                <span className="text-slate-400 shrink-0">Success Redirect:</span>
                <span className="font-mono text-slate-400 text-[11px] truncate">
                  {zinipayRedirectUrl || `${status?.app?.url}/payment/success`}
                </span>
              </div>
            </div>

            {/* Test Invoice Trigger */}
            <div className="pt-1">
              <button
                onClick={handleTestCreateInvoice}
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

          {/* 5. WhatsApp Cloud API Webhook Card */}
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
                    onClick={() => handleCopy(status?.whatsapp?.verifyToken || '', 'wa_token')}
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
                  {waTestMsg.success ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                  <span className="break-all">{waTestMsg.message}</span>
                </div>
              )}

              <button
                onClick={handleSendWhatsAppTest}
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

          {/* 4. Telegram Worker Bot Card */}
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
                  {tgWebhookMsg.success ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                  <span>{tgWebhookMsg.message}</span>
                </div>
              )}

              {/* 1-Click Telegram Webhook Auto-Registration */}
              <button
                onClick={handleRegisterTelegramWebhook}
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
        </div>
      </main>
    </div>
  );
}
