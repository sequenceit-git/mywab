'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Server, RefreshCw } from 'lucide-react';
import { SystemStatus } from './types';
import { MongoDbConfigCard } from './components/MongoDbConfigCard';
import { KokosConfigCard } from './components/KokosConfigCard';
import { PinexConfigCard } from './components/PinexConfigCard';
import { ZiniPayConfigCard } from './components/ZiniPayConfigCard';
import { WhatsAppConfigCard } from './components/WhatsAppConfigCard';
import { TelegramConfigCard } from './components/TelegramConfigCard';

export default function ConfigPage() {
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [tgWebhookLoading, setTgWebhookLoading] = useState(false);
  const [tgWebhookMsg, setTgWebhookMsg] = useState<{ success: boolean; message: string } | null>(null);

  // Kokos Activator API State (auto-fulfillment is now toggled per-package, and stock check
  // now lives at the top of the Pricing page package list)
  const [kokosConfigured, setKokosConfigured] = useState<boolean>(false);
  const [kokosLookupUid, setKokosLookupUid] = useState<string>('');
  const [kokosLookupLoading, setKokosLookupLoading] = useState<boolean>(false);
  const [kokosLookupResult, setKokosLookupResult] = useState<{ name?: string; error?: string } | null>(null);

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

  // WhatsApp Test State
  const [waTestLoading, setWaTestLoading] = useState(false);
  const [waTestMsg, setWaTestMsg] = useState<{ success: boolean; message: string } | null>(null);

  const fetchKokosStatus = async () => {
    try {
      const res = await fetch('/api/system/kokos');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setKokosConfigured(data.configured);
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
    } catch {
      setTgWebhookMsg({
        success: false,
        message: 'Network error registering webhook'
      });
    } finally {
      setTgWebhookLoading(false);
    }
  };

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
    } catch {
      setWaTestMsg({
        success: false,
        message: 'Network error sending test message'
      });
    } finally {
      setWaTestLoading(false);
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
    } catch {
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

        {/* 6 Connected Services Grid (2 columns on desktop) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* 1. MongoDB Database Card */}
          <MongoDbConfigCard status={status} />

          {/* 2. Kokos Activator API Card (PUBG UID Auto-Fulfillment) */}
          <KokosConfigCard
            kokosConfigured={kokosConfigured}
            kokosLookupUid={kokosLookupUid}
            setKokosLookupUid={setKokosLookupUid}
            kokosLookupLoading={kokosLookupLoading}
            kokosLookupResult={kokosLookupResult}
            onLookupPlayer={handleLookupPlayer}
          />

          {/* 3. Pinex API (Free Fire Auto-Fulfillment) */}
          <PinexConfigCard
            pinexConfigured={pinexConfigured}
            pinexAutoFulfill={pinexAutoFulfill}
            pinexToggling={pinexToggling}
            pinexToggleMsg={pinexToggleMsg}
            onTogglePinex={handleTogglePinex}
          />

          {/* 4. ZiniPay Payment Gateway (Auto-Verification) */}
          <ZiniPayConfigCard
            zinipayConfigured={zinipayConfigured}
            zinipayAutoPayment={zinipayAutoPayment}
            zinipayToggling={zinipayToggling}
            zinipayToggleMsg={zinipayToggleMsg}
            zinipayWebhookUrl={zinipayWebhookUrl}
            zinipayRedirectUrl={zinipayRedirectUrl}
            appUrl={status?.app?.url}
            zinipayTestLoading={zinipayTestLoading}
            zinipayTestResult={zinipayTestResult}
            onToggleZinipay={handleToggleZinipay}
            onTestCreateInvoice={handleTestCreateInvoice}
            onCopy={handleCopy}
          />

          {/* 5. WhatsApp Cloud API Webhook Card */}
          <WhatsAppConfigCard
            status={status}
            currentWhatsAppWebhook={currentWhatsAppWebhook}
            copiedKey={copiedKey}
            waTestLoading={waTestLoading}
            waTestMsg={waTestMsg}
            onCopy={handleCopy}
            onSendWhatsAppTest={handleSendWhatsAppTest}
          />

          {/* 6. Telegram Worker Bot Card */}
          <TelegramConfigCard
            status={status}
            tgWebhookLoading={tgWebhookLoading}
            tgWebhookMsg={tgWebhookMsg}
            onRegisterTelegramWebhook={handleRegisterTelegramWebhook}
          />
        </div>
      </main>
    </div>
  );
}
