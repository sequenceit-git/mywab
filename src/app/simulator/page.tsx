'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Header } from '@/components/Header';
import {
  Send,
  Bot,
  User,
  Sparkles,
  Database,
  ArrowRight,
  RefreshCw,
  Phone,
  CheckCheck,
  Zap,
  ShoppingBag,
  Info,
  ExternalLink,
  MessageCircle,
  Clock,
  ShieldCheck
} from 'lucide-react';
import Link from 'next/link';

interface SimMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  time: string;
}

interface ExecutionLog {
  step: string;
  detail: string;
  timestamp: string;
  type: 'ai' | 'db' | 'telegram' | 'whatsapp';
}

const PRESET_PROMPTS = [
  { label: '🛍️ Browse Catalog', text: 'আপনাদের দোকানে কি কি পণ্য পাওয়া যাবে আর দাম কত?' },
  { label: '🚚 Ask Delivery Charges', text: 'ঢাকার ভেতরে এবং বাইরে ডেলিভারি চার্জ কত এবং কতদিন সময় লাগে?' },
  { label: '💳 Payment Methods', text: 'ক্যাশ অন ডেলিভারি এবং বিকাশে পেমেন্ট করার সুযোগ আছে কি?' },
  { label: '⚡ Complete Order Flow', text: 'আমি ১টি Classic Polo Shirt কিনতে চাই। নাম: তানভীর আহমেদ, ঠিকানা: বাসা ১২, রোড ৪, ধানমন্ডি, ঢাকা, ফোন: 01711223344' },
];

export default function WhatsAppSimulatorPage() {
  const [messages, setMessages] = useState<SimMessage[]>([
    {
      id: 'welcome-1',
      sender: 'bot',
      text: '👋 আসসালামু আলাইকুম! WapBusiness AI শপিং অ্যাসিস্ট্যান্টে আপনাকে স্বাগতম।\n\nপণ্য তালিকা দেখতে, মূল্য জানতে বা সরাসরি অর্ডার করতে যেকোনো বার্তা লিখুন। 😊',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([]);
  const [latestCreatedOrder, setLatestCreatedOrder] = useState<any>(null);
  const [simPhone, setSimPhone] = useState('+8801711223344');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || loading) return;

    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: SimMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      time: userTime
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputText('');
    setLoading(true);

    try {
      const response = await fetch('/api/simulator/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          phone: simPhone,
          conversationId: `sim-${simPhone}`
        })
      });

      const data = await response.json();
      if (data.success) {
        const botMsg: SimMessage = {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: data.reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, botMsg]);

        if (data.logs && Array.isArray(data.logs)) {
          setExecutionLogs(prev => [...data.logs, ...prev].slice(0, 15));
        }

        if (data.createdOrder) {
          setLatestCreatedOrder(data.createdOrder);
        }
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            sender: 'bot',
            text: `⚠️ Error: ${data.error || 'Failed to process message'}`,
            time: userTime
          }
        ]);
      }
    } catch (err) {
      console.error('Simulator error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'bot',
        text: '👋 আসসালামু আলাইকুম! WapBusiness AI শপিং অ্যাসিস্ট্যান্টে আপনাকে স্বাগতম।\n\nপণ্য তালিকা দেখতে, মূল্য জানতে বা সরাসরি অর্ডার করতে যেকোনো বার্তা লিখুন। 😊',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setExecutionLogs([]);
    setLatestCreatedOrder(null);
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header
        title="WhatsApp AI Test Lab & Demo Flow"
        subtitle="Live end-to-end interactive simulation of customer WhatsApp chatting, AI processing, Supabase storage & Telegram dispatch"
      />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Notice Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-brand-950/80 via-dark-900 to-indigo-950/80 border border-brand-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-400 border border-brand-500/40 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Full Autonomous Backend Engine Active</h3>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Live Test Lab</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Messages typed below trigger the <b>real backend LangChain AI agent</b>, save to <b>Supabase</b>, and dispatch live order cards to your <b>Telegram Worker Group</b>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition border border-slate-700"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Chat</span>
            </button>
          </div>
        </div>

        {/* 2-Column Split: Interactive Phone + Live Execution Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Smartphone WhatsApp Simulation (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col items-center">
            <div className="w-full max-w-md rounded-[38px] border-4 border-slate-800 bg-[#0b141a] shadow-2xl overflow-hidden flex flex-col h-[680px] relative">
              {/* Phone Speaker & Camera Notch */}
              <div className="h-6 bg-[#1f2c34] flex items-center justify-center relative">
                <div className="w-16 h-1.5 rounded-full bg-slate-800"></div>
                <div className="absolute right-4 text-[10px] font-mono text-slate-400">100% 🔋</div>
              </div>

              {/* WhatsApp Chat Header */}
              <div className="bg-[#1f2c34] p-3 border-b border-slate-700/60 flex items-center justify-between z-10 text-white">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-emerald-700 flex items-center justify-center font-bold text-sm shadow">
                      <Bot className="w-5 h-5 text-emerald-100" />
                    </div>
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#1f2c34]"></span>
                  </div>
                  <div>
                    <div className="text-sm font-bold flex items-center gap-1.5">
                      <span>WapBusiness Store</span>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                      <span>AI Shopping Assistant</span>
                      <span>•</span>
                      <span className="text-slate-400">Online</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-slate-300">
                  <div className="text-[10px] font-mono px-2 py-1 rounded bg-slate-800/80 text-slate-300 border border-slate-700">
                    {simPhone}
                  </div>
                </div>
              </div>

              {/* WhatsApp Messages Feed */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#0b141a] bg-opacity-95">
                <div className="text-center my-2">
                  <span className="text-[10px] bg-[#182229] text-slate-400 px-3 py-1 rounded-lg border border-slate-800 shadow-sm">
                    🔒 Messages are end-to-end encrypted & powered by WapBot AI
                  </span>
                </div>

                {messages.map((msg) => {
                  const isUser = msg.sender === 'user';

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] p-3 rounded-2xl text-xs whitespace-pre-wrap leading-relaxed shadow-md relative ${
                          isUser
                            ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none'
                            : 'bg-[#202c33] text-[#d1d7db] rounded-tl-none border border-slate-800'
                        }`}
                      >
                        {msg.text}

                        <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 mt-1 float-right pl-3">
                          <span>{msg.time}</span>
                          {isUser && <CheckCheck className="w-3.5 h-3.5 text-sky-400" />}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {loading && (
                  <div className="flex items-start">
                    <div className="bg-[#202c33] border border-slate-800 p-3 rounded-2xl rounded-tl-none text-xs text-emerald-400 flex items-center gap-2">
                      <Bot className="w-3.5 h-3.5 animate-spin" />
                      <span className="animate-pulse">WapBot AI is typing...</span>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Quick Preset Pills */}
              <div className="px-3 py-2 bg-[#182229] border-t border-slate-800 flex gap-2 overflow-x-auto no-scrollbar">
                {PRESET_PROMPTS.map((preset, idx) => (
                  <button
                    key={idx}
                    disabled={loading}
                    onClick={() => handleSendMessage(preset.text)}
                    className="shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full bg-[#202c33] hover:bg-[#2a3942] text-emerald-300 border border-emerald-500/30 transition shadow-sm disabled:opacity-50"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* WhatsApp Message Input Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="p-3 bg-[#1f2c34] border-t border-slate-700/80 flex items-center gap-2"
              >
                <input
                  type="text"
                  placeholder="Type a message on WhatsApp..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={loading}
                  className="flex-1 bg-[#2a3942] border border-slate-700 rounded-full px-4 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || loading}
                  className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-40 text-white flex items-center justify-center transition shadow-md shrink-0"
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </button>
              </form>
            </div>
          </div>

          {/* Right: Live Backend Execution Inspector (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Created Order Live Alert Card */}
            {latestCreatedOrder && (
              <div className="p-5 rounded-2xl bg-gradient-to-tr from-emerald-950/70 via-dark-900 to-emerald-900/40 border border-emerald-500/40 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                    <ShoppingBag className="w-4 h-4" />
                    <span>Order Created In Supabase!</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {latestCreatedOrder.status}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Order ID:</span>
                    <span className="font-mono font-bold text-white">{latestCreatedOrder.order_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Amount:</span>
                    <span className="font-black text-brand-400">৳{latestCreatedOrder.total_amount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Customer:</span>
                    <span className="text-slate-200">{latestCreatedOrder.delivery_address?.name || 'Customer'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Address:</span>
                    <span className="text-slate-300 text-right truncate max-w-[180px]">{latestCreatedOrder.delivery_address?.address}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link
                    href="/orders"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-dark-950 font-bold text-xs transition"
                  >
                    <span>View in Live Orders</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )}

            {/* Architecture Pipeline Explanation */}
            <div className="p-5 rounded-2xl bg-dark-900/90 border border-slate-800/80 shadow-md space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-400" />
                <span>Backend Autonomous Flow</span>
              </h4>

              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <div>
                    <div className="font-semibold text-slate-200">Customer Messages on WhatsApp</div>
                    <div className="text-[11px] text-slate-400">Inbound webhook received at <code>/api/webhooks/whatsapp</code></div>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <div>
                    <div className="font-semibold text-slate-200">LangChain AI Agent Reasoning</div>
                    <div className="text-[11px] text-slate-400">Detects product interest, checks stock in DB, asks delivery address</div>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <div>
                    <div className="font-semibold text-slate-200">Atomic Database Order Write</div>
                    <div className="text-[11px] text-slate-400">Writes order record to Supabase PostgreSQL table <code>orders</code></div>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-telegram-500/20 text-telegram-500 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                  <div>
                    <div className="font-semibold text-slate-200">Telegram Worker Card Dispatched</div>
                    <div className="text-[11px] text-slate-400">Posted with Claim button to group <code>test wab</code> (@mywab010bot)</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Real-time Execution Logs */}
            <div className="p-5 rounded-2xl bg-dark-900/90 border border-slate-800/80 shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>Execution Event Stream</span>
                </h4>
                <span className="text-[10px] text-slate-500 font-mono">{executionLogs.length} events</span>
              </div>

              {executionLogs.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs bg-slate-950/40 rounded-xl border border-slate-800/50">
                  Send a message from the phone to view live backend logs.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {executionLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/60 text-xs space-y-0.5 font-mono"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`font-bold text-[11px] ${
                            log.type === 'telegram'
                              ? 'text-telegram-500'
                              : log.type === 'db'
                              ? 'text-emerald-400'
                              : log.type === 'ai'
                              ? 'text-brand-400'
                              : 'text-sky-400'
                          }`}
                        >
                          [{log.step}]
                        </span>
                        <span className="text-[10px] text-slate-500">{log.timestamp}</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug">{log.detail}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
