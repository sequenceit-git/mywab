'use client';

import React, { useState } from 'react';
import { Header } from '@/components/Header';
import {
  MessageSquare,
  Bot,
  Send,
  Sparkles,
  ShoppingBag,
  Users,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Zap
} from 'lucide-react';
import { Order } from '@/types';

export default function SimulatorPage() {
  const [messages, setMessages] = useState<Array<{ sender: 'CUSTOMER' | 'AI' | 'SYSTEM'; text: string; time: string }>>([
    {
      sender: 'SYSTEM',
      text: 'Simulated WhatsApp Session Initialized. Customer phone: +8801700000001',
      time: new Date().toLocaleTimeString()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [dispatchedOrder, setDispatchedOrder] = useState<Order | null>(null);
  const [claimedWorker, setClaimedWorker] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<string>('PENDING_CLAIM');
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 15)]);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || loading) return;

    setInputText('');
    setLoading(true);

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { sender: 'CUSTOMER', text, time: now }]);
    addLog(`Customer WhatsApp Message Sent: "${text}"`);

    try {
      // Simulate webhook call to backend
      const res = await fetch('/api/webhooks/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry: [
            {
              changes: [
                {
                  value: {
                    contacts: [{ profile: { name: 'Tanzeem Rahman' } }],
                    messages: [
                      {
                        from: '8801700000001',
                        text: { body: text },
                        timestamp: String(Date.now())
                      }
                    ]
                  }
                }
              ]
            }
          ]
        })
      });

      const data = await res.json();
      addLog(`AI LangChain + OpenAI Engine Processed Request: ${JSON.stringify(data)}`);

      // Fetch the latest conversation and orders
      const convRes = await fetch('/api/chat');
      const convData = await convRes.json();
      if (convData.success && convData.conversations?.length > 0) {
        const lastConv = convData.conversations[0];
        const lastBotMsg = lastConv.messages?.filter((m: { sender: string }) => m.sender === 'BOT').slice(-1)[0];
        if (lastBotMsg) {
          setMessages((prev) => [
            ...prev,
            { sender: 'AI', text: lastBotMsg.content, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
          ]);
        }
      }

      // Check if an order was created
      const ordersRes = await fetch('/api/orders');
      const ordersData = await ordersRes.json();
      if (ordersData.success && ordersData.orders?.length > 0) {
        const latestOrder = ordersData.orders[0];
        setDispatchedOrder(latestOrder);
        setOrderStatus(latestOrder.status);
        if (latestOrder.current_worker) {
          setClaimedWorker(latestOrder.current_worker.full_name);
        }
        addLog(`Telegram Dispatch Card Generated for Order: ${latestOrder.order_id}`);
      }
    } catch (err) {
      console.error(err);
      addLog(`Error: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleWorkerClaim = async (workerName: string, telegramId: number) => {
    if (!dispatchedOrder) return;
    addLog(`Worker "${workerName}" clicked [⚡ Claim Order]`);

    try {
      const res = await fetch(`/api/orders/${dispatchedOrder.order_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'claim',
          telegramUserId: telegramId,
          workerName
        })
      });

      const data = await res.json();
      if (data.success) {
        setClaimedWorker(workerName);
        setOrderStatus('CLAIMED');
        addLog(`Atomic Lock Confirmed: Order assigned to ${workerName}. WhatsApp Customer Notification Sent!`);
        
        // Append WhatsApp notification
        setMessages((prev) => [
          ...prev,
          {
            sender: 'SYSTEM',
            text: `🚚 WhatsApp Notification Sent to Customer: Your order #${dispatchedOrder.order_id} is now claimed and being processed by ${workerName}!`,
            time: new Date().toLocaleTimeString()
          }
        ]);
      } else {
        alert(data.message || 'Already claimed by another worker!');
        addLog(`Double-Claim Blocked: ${data.message}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleWorkerDelivered = async () => {
    if (!dispatchedOrder) return;
    addLog(`Worker clicked [✅ Mark Delivered]`);

    try {
      const res = await fetch(`/api/orders/${dispatchedOrder.order_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DELIVERED' })
      });

      const data = await res.json();
      if (data.success) {
        setOrderStatus('DELIVERED');
        addLog(`Order #${dispatchedOrder.order_id} marked as DELIVERED in Supabase DB.`);

        setMessages((prev) => [
          ...prev,
          {
            sender: 'SYSTEM',
            text: `🎉 WhatsApp Notification Sent to Customer: Your order #${dispatchedOrder.order_id} has been delivered successfully! Thank you for shopping with us! ❤️`,
            time: new Date().toLocaleTimeString()
          }
        ]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <Header
        title="Interactive End-to-End System Simulator"
        subtitle="Simulate WhatsApp customer chats, LangChain AI ordering, and Telegram worker dispatching"
      />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-0 overflow-hidden bg-slate-950">
        {/* PANEL 1: WhatsApp Customer Chat (Left) */}
        <div className="border-r border-slate-800 flex flex-col h-full bg-dark-950">
          <div className="p-4 border-b border-slate-800 bg-dark-900 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-xs">
                WA
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">WhatsApp Customer Interface</h3>
                <p className="text-[10px] text-slate-400 font-mono">+8801700000001</p>
              </div>
            </div>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-brand-500/20 text-brand-400 border border-brand-500/30">
              Customer View
            </span>
          </div>

          {/* Quick Preset Message Buttons */}
          <div className="p-3 bg-dark-900/50 border-b border-slate-800/80 space-y-1.5 text-xs">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Quick Presets:</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => handleSendMessage('আপনাদের পোলো শার্ট আছে? দাম কত?')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition"
              >
                👕 পণ্য ও দাম জানতে চাই
              </button>
              <button
                onClick={() => handleSendMessage('ডেলিভারি চার্জ কত এবং কত দিন লাগবে?')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition"
              >
                🚚 ডেলিভারি চার্জ
              </button>
              <button
                onClick={() => handleSendMessage('আমি ১টি ক্লাসিক পোলো শার্ট কিনতে চাই। নাম: তানজিম রহমান, ঠিকানা: বাড়ি ৪২, রোড ১১, বনানী, ঢাকা, ফোন: ০১৭১১০০২২৩৩')}
                className="px-2.5 py-1 rounded-lg bg-brand-500/15 hover:bg-brand-500/25 text-brand-300 border border-brand-500/30 text-[11px] font-semibold transition"
              >
                ⚡ দ্রুত অর্ডার তৈরি
              </button>
            </div>
          </div>

          {/* Message Thread */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex flex-col ${
                  m.sender === 'CUSTOMER'
                    ? 'items-end'
                    : m.sender === 'AI'
                    ? 'items-start'
                    : 'items-center my-2'
                }`}
              >
                {m.sender === 'SYSTEM' ? (
                  <div className="p-2 rounded-lg bg-slate-900 text-slate-400 border border-slate-800 text-[10px] text-center max-w-xs">
                    {m.text}
                  </div>
                ) : (
                  <>
                    <div className="text-[10px] text-slate-500 mb-0.5 px-1 flex items-center gap-1">
                      <span>{m.sender === 'CUSTOMER' ? 'You' : 'WapBot AI'}</span>
                      <span>•</span>
                      <span>{m.time}</span>
                    </div>
                    <div
                      className={`max-w-xs p-3 rounded-2xl text-xs whitespace-pre-wrap leading-relaxed shadow-sm ${
                        m.sender === 'CUSTOMER'
                          ? 'bg-slate-800 text-white rounded-tr-sm'
                          : 'bg-brand-950/80 text-brand-100 border border-brand-500/30 rounded-tl-sm'
                      }`}
                    >
                      {m.text}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Input Bar */}
          <div className="p-3 border-t border-slate-800 bg-dark-900 flex gap-2">
            <input
              type="text"
              placeholder="Type in Bangla or English..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500/50"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={loading || !inputText.trim()}
              className="px-3 py-2 rounded-xl bg-brand-500 text-dark-950 font-bold text-xs disabled:opacity-50 flex items-center gap-1"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* PANEL 2: Telegram Worker Group Simulator (Center/Right) */}
        <div className="border-r border-slate-800 flex flex-col h-full bg-dark-900/60">
          <div className="p-4 border-b border-slate-800 bg-dark-900 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-telegram-500/20 text-telegram-500 flex items-center justify-center font-bold text-xs">
                TG
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">Telegram Worker Group</h3>
                <p className="text-[10px] text-slate-400">@WapBusiness_Delivery_Group</p>
              </div>
            </div>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-telegram-500/20 text-telegram-500 border border-telegram-500/30">
              Worker View
            </span>
          </div>

          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            {dispatchedOrder ? (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-[11px] font-bold text-telegram-500 flex items-center gap-1">
                    <Bot className="w-3.5 h-3.5" /> Telegram Bot Dispatch
                  </span>
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      orderStatus === 'PENDING_CLAIM'
                        ? 'status-badge-pending'
                        : orderStatus === 'DELIVERED'
                        ? 'status-badge-delivered'
                        : 'status-badge-claimed'
                    }`}
                  >
                    {orderStatus}
                  </span>
                </div>

                {/* Card Content */}
                <div className="text-xs text-slate-300 space-y-1.5 font-mono">
                  <div>📦 <b>Order ID:</b> <span className="text-white font-bold">{dispatchedOrder.order_id}</span></div>
                  <div>💰 <b>Total Amount:</b> ৳{dispatchedOrder.total_amount}</div>
                  <div>👤 <b>Customer:</b> {dispatchedOrder.customer?.name || dispatchedOrder.delivery_address.name || 'Customer'}</div>
                  <div>📞 <b>Phone:</b> {dispatchedOrder.delivery_phone}</div>
                  <div>📍 <b>Address:</b> {dispatchedOrder.delivery_address.address}</div>
                  {claimedWorker && (
                    <div className="pt-2 text-emerald-400 font-sans font-bold">
                      👷 Assigned Worker: {claimedWorker}
                    </div>
                  )}
                </div>

                {/* Worker Interactive Action Buttons */}
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Simulate Worker Taps:</div>

                  {orderStatus === 'PENDING_CLAIM' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleWorkerClaim('Abdur Rahim', 10098234)}
                        className="py-2 px-3 rounded-xl bg-telegram-500 hover:bg-telegram-600 text-white font-bold text-xs transition flex items-center justify-center gap-1 shadow-md"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Claim as Rahim</span>
                      </button>
                      <button
                        onClick={() => handleWorkerClaim('Karimul Hasan', 20087345)}
                        className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition flex items-center justify-center gap-1"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Claim as Karim</span>
                      </button>
                    </div>
                  ) : orderStatus === 'CLAIMED' || orderStatus === 'PROCESSING' ? (
                    <button
                      onClick={handleWorkerDelivered}
                      className="w-full py-2.5 px-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-950 font-extrabold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>✅ Mark Order as Delivered (Telegram Action)</span>
                    </button>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs text-center">
                      🎉 Order Successfully Delivered!
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-20 text-center text-slate-500 text-xs space-y-2">
                <ShoppingBag className="w-8 h-8 mx-auto text-slate-600" />
                <p>No active order dispatched yet.</p>
                <p className="text-[10px] text-slate-400">
                  Use the WhatsApp panel on the left to place an order or tap a Quick Preset.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* PANEL 3: Real-time System Event Log & Architecture Monitor (Right) */}
        <div className="flex flex-col h-full bg-dark-950">
          <div className="p-4 border-b border-slate-800 bg-dark-900 flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Live System Logs & Architecture</h3>
            <span className="text-[9px] font-mono text-slate-400">Supabase ↔ OpenAI</span>
          </div>

          <div className="flex-1 p-4 font-mono text-[11px] text-slate-400 space-y-2 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-slate-600 text-center py-20">System events will stream here...</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="p-2 rounded bg-slate-900/80 border border-slate-800/80 leading-relaxed break-words text-slate-300">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
