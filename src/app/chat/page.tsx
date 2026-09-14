'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/Header';
import {
  MessageSquare,
  Bot,
  User,
  Send,
  Sparkles,
  ShieldCheck,
  Phone,
  MapPin,
  Clock,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { Conversation, Message } from '@/types';

export default function LiveChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/chat');
      const data = await res.json();
      if (data.success) {
        setConversations(data.conversations);
        if (!selectedConv && data.conversations.length > 0) {
          setSelectedConv(data.conversations[0]);
        } else if (selectedConv) {
          const updated = data.conversations.find((c: Conversation) => c.id === selectedConv.id);
          if (updated) setSelectedConv(updated);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConv?.messages]);

  const toggleAiMode = async () => {
    if (!selectedConv) return;
    const newMode = !selectedConv.is_ai_active;
    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConv.id,
          isAiActive: newMode
        })
      });
      const data = await res.json();
      if (data.success) {
        setSelectedConv(prev => prev ? { ...prev, is_ai_active: newMode } : null);
        fetchConversations();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConv || !replyText.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConv.id,
          content: replyText.trim(),
          phone: selectedConv.user?.phone_number
        })
      });
      const data = await res.json();
      if (data.success) {
        setReplyText('');
        fetchConversations();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <Header
        title="WhatsApp Live Inbox & AI Control"
        subtitle="Manage bilingual customer conversations with one-click manual takeover"
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Conversation List */}
        <div className="w-80 border-r border-slate-800 bg-dark-900 flex flex-col">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Conversations</span>
            <span className="text-[10px] font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300">
              {conversations.length} active
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500">Loading inbox...</div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">No active conversations.</div>
            ) : (
              conversations.map((c) => {
                const isSelected = selectedConv?.id === c.id;
                const lastMsg = c.messages?.[c.messages.length - 1];

                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedConv(c)}
                    className={`p-4 cursor-pointer transition ${
                      isSelected ? 'bg-slate-800/80 border-l-4 border-brand-500' : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white truncate">
                        {c.user?.name || c.user?.phone_number || 'WhatsApp Customer'}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 truncate">
                      {lastMsg?.content || 'No messages'}
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-500">{c.user?.phone_number}</span>
                      {c.is_ai_active ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400 flex items-center gap-1 border border-brand-500/30">
                          <Bot className="w-2.5 h-2.5" /> AI Mode
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 flex items-center gap-1 border border-amber-500/30">
                          <User className="w-2.5 h-2.5" /> Manual
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Middle: Active Chat Room */}
        {selectedConv ? (
          <div className="flex-1 flex flex-col bg-slate-950/70">
            {/* Chat Room Top Bar */}
            <div className="p-4 border-b border-slate-800 bg-dark-900/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brand-500/20 border border-brand-500/40 flex items-center justify-center text-brand-400 font-bold text-xs">
                  {selectedConv.user?.name?.[0] || 'W'}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {selectedConv.user?.name || 'Customer'}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                    <Phone className="w-3 h-3 text-slate-500" />
                    <span>{selectedConv.user?.phone_number}</span>
                  </div>
                </div>
              </div>

              {/* AI Auto-pilot Switch */}
              <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-2 rounded-xl">
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-200">
                    {selectedConv.is_ai_active ? 'AI Auto-Pilot' : 'Human Takeover'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {selectedConv.is_ai_active ? 'OpenAI answers automatically' : 'Staff replies directly'}
                  </div>
                </div>
                <button
                  onClick={toggleAiMode}
                  className={`p-1 rounded-lg transition ${
                    selectedConv.is_ai_active ? 'text-brand-400' : 'text-slate-500'
                  }`}
                >
                  {selectedConv.is_ai_active ? (
                    <ToggleRight className="w-8 h-8 text-brand-400" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-slate-500" />
                  )}
                </button>
              </div>
            </div>

            {/* Chat Messages Log */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              {selectedConv.messages?.map((msg) => {
                const isCustomer = msg.sender === 'CUSTOMER';
                const isBot = msg.sender === 'BOT';

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'}`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1 px-1">
                      {isCustomer ? (
                        <>
                          <User className="w-3 h-3 text-slate-400" />
                          <span>Customer</span>
                        </>
                      ) : isBot ? (
                        <>
                          <Bot className="w-3 h-3 text-brand-400" />
                          <span className="text-brand-400 font-semibold">WapBot AI (LangChain/OpenAI)</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3 h-3 text-indigo-400" />
                          <span className="text-indigo-400 font-semibold">Support Admin</span>
                        </>
                      )}
                      <span>•</span>
                      <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <div
                      className={`max-w-lg p-3.5 rounded-2xl text-xs whitespace-pre-wrap leading-relaxed shadow-sm ${
                        isCustomer
                          ? 'bg-slate-800 text-slate-100 rounded-tl-sm border border-slate-700/50'
                          : isBot
                          ? 'bg-brand-950/80 text-brand-100 border border-brand-500/30 rounded-tr-sm'
                          : 'bg-indigo-600 text-white rounded-tr-sm'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              })}
              <div ref={chatBottomRef} />
            </div>

            {/* Reply Composer */}
            <form onSubmit={handleSendMessage} className="p-4 bg-dark-900 border-t border-slate-800 flex gap-2">
              <input
                type="text"
                placeholder={
                  selectedConv.is_ai_active
                    ? 'AI Auto-Pilot is ON. Typing here sends a manual admin message to WhatsApp...'
                    : 'Type a message to the customer on WhatsApp...'
                }
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500/50"
              />
              <button
                type="submit"
                disabled={!replyText.trim() || sending}
                className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-dark-950 font-bold text-xs flex items-center gap-1.5 transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
            Select a conversation to start messaging.
          </div>
        )}

        {/* Right: Customer Profile & Order History */}
        {selectedConv?.user && (
          <div className="w-72 border-l border-slate-800 bg-dark-900 p-5 space-y-5 hidden xl:block overflow-y-auto">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Customer Profile</h4>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div>
                  <div className="text-[10px] text-slate-500">Name</div>
                  <div className="font-semibold text-slate-200">{selectedConv.user.name || 'Not provided yet'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">Phone</div>
                  <div className="font-mono text-slate-200">{selectedConv.user.phone_number}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">Saved Address</div>
                  <div className="text-slate-300 text-[11px]">{selectedConv.user.address_profile.full_address || 'No address saved yet'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">Tag</div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-brand-400 border border-slate-700">
                    {selectedConv.user.status_tag}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
