'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import {
  MessageSquare,
  Search,
  Bot,
  User,
  Send,
  RefreshCw,
  Sparkles,
  Phone,
  Shield,
  Clock,
  CheckCheck,
  CheckCircle2,
  ExternalLink,
  ChevronLeft,
  RotateCcw,
  Zap,
  Volume2,
  VolumeX,
  CreditCard,
  ShoppingBag,
  Info,
  Copy,
  Check,
  AlertTriangle,
  ArrowRight,
  Flame,
  X
} from 'lucide-react';
import { Conversation, Message, Order, OrderStatus } from '@/types';
import { WhatsAppIcon, BrandLogo } from '@/components/BrandIcons';

// Web Audio API notification chime generator (100% offline, zero external dependencies)
function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880, now);
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.15); // D6

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.35);
    osc2.stop(now + 0.35);
  } catch {
    // Ignore audio permission or context restrictions
  }
}

const CANNED_RESPONSES = [
  {
    label: '👋 Welcome / Menu',
    text: '👋 আসসালামু আলাইকুম! DS Dukan 24/7 গেমিং শপে আপনাকে স্বাগতম। আপনাকে কীভাবে সাহায্য করতে পারি? কত ইউসি বা কোন প্যাকেজটি নিতে চান?'
  },
  {
    label: '💳 Send TrxID',
    text: 'অনুগ্রহ করে আপনার বিকাশ/নগদ/রকেট পেমেন্টের TrxID অথবা লাস্ট ৪ ডিজিট লিখে এখানে পাঠান।'
  },
  {
    label: '⚡ 5-15 Min Delivery',
    text: 'আমাদের ডেলিভারি সময় সাধারণত ৫ থেকে ১৫ মিনিট। আপনার অর্ডারটি প্রক্রিয়াধীন আছে, অতি দ্রুত যুক্ত করে দেওয়া হবে।'
  },
  {
    label: '🆔 Check UID',
    text: 'দয়া করে আপনার সঠিক গেম Player UID-টি আরেকবার চেক করে এখানে লিখে পাঠান।'
  },
  {
    label: '✅ Top-Up Done',
    text: '✅ আপনার অর্ডারটি সফলভাবে সম্পন্ন হয়েছে এবং অ্যাকাউন্টে টপ-আপ যুক্ত করা হয়েছে। DS Dukan এর সাথে কেনাকাটা করার জন্য ধন্যবাদ! ❤️'
  }
];

export default function ChatAdminPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'ACTIVE_FUNNEL' | 'BOT_ACTIVE' | 'HUMAN_MODE' | 'VIP'>('ALL');

  // Active chat stream state
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isTogglingAi, setIsTogglingAi] = useState(false);
  const [isResettingSession, setIsResettingSession] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // UX controls
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const [showRightDrawer, setShowRightDrawer] = useState(true);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // References
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef<number>(0);
  const isFirstLoadRef = useRef<boolean>(true);

  // Fetch all conversations
  const fetchConversations = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch('/api/chat', {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.conversations)) {
          const list: Conversation[] = data.conversations;
          setConversations(list);

          // Audio notification check
          const totalMsgs = list.reduce((acc, c) => acc + (c.messages?.length || 0), 0);
          if (!isFirstLoadRef.current && totalMsgs > prevMsgCountRef.current && soundEnabled) {
            playNotificationChime();
          }
          prevMsgCountRef.current = totalMsgs;
          isFirstLoadRef.current = false;

          // Default selection if none selected
          if (!selectedConvId && list.length > 0) {
            setSelectedConvId(list[0].id);
          }
        }
      }
    } catch (err) {
      console.error('[Chat Fetch Error]:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Initial load & Polling interval
  useEffect(() => {
    fetchConversations(false);
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchConversations(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [autoRefresh, soundEnabled, selectedConvId]);

  // Find currently active conversation
  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.id === selectedConvId) || conversations[0] || null;
  }, [conversations, selectedConvId]);

  // Fetch orders for active conversation
  useEffect(() => {
    if (!activeConversation) return;

    let isMounted = true;
    setLoadingOrders(true);

    const fetchActiveDetails = async () => {
      try {
        const res = await fetch(`/api/chat?id=${encodeURIComponent(activeConversation.id)}`, {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.success && Array.isArray(data.orders)) {
            setCustomerOrders(data.orders);
          }
        }
      } catch (err) {
        console.warn('[Fetch Active Orders Error]:', err);
      } finally {
        if (isMounted) setLoadingOrders(false);
      }
    };

    fetchActiveDetails();

    return () => {
      isMounted = false;
    };
  }, [activeConversation?.id, activeConversation?.user_id]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeConversation?.messages?.length, selectedConvId]);

  // Filter conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const user = c.user;
      const phone = user?.phone_number || (c as any).phone || '';
      const name = user?.name || '';
      const lastMsg = c.messages?.[c.messages.length - 1]?.content || '';
      const draftUid = c.draft_state?.draftOrder?.playerUid || '';

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          phone.toLowerCase().includes(q) ||
          name.toLowerCase().includes(q) ||
          lastMsg.toLowerCase().includes(q) ||
          draftUid.toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Filter tabs
      const step = c.draft_state?.step || c.session_state?.step || 'IDLE';
      if (filterTab === 'ACTIVE_FUNNEL') {
        return step !== 'IDLE';
      }
      if (filterTab === 'BOT_ACTIVE') {
        return c.is_ai_active;
      }
      if (filterTab === 'HUMAN_MODE') {
        return !c.is_ai_active;
      }
      if (filterTab === 'VIP') {
        return user?.status_tag === 'VIP' || user?.customer_profile?.vip_status;
      }

      return true;
    });
  }, [conversations, searchQuery, filterTab]);

  // Send Admin message
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || messageInput).trim();
    if (!text || !activeConversation || isSending) return;

    const phone = activeConversation.user?.phone_number || (activeConversation as any).phone || '';
    setIsSending(true);

    // Optimistic UI update
    const tempMsgId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempMsgId,
      conversation_id: activeConversation.id,
      sender: 'ADMIN',
      content: text,
      created_at: new Date().toISOString()
    };

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === activeConversation.id) {
          return {
            ...c,
            last_message_at: optimisticMsg.created_at,
            messages: [...(c.messages || []), optimisticMsg]
          };
        }
        return c;
      })
    );
    setMessageInput('');

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConversation.id,
          phone,
          content: text
        })
      });

      if (res.ok) {
        // Silently re-fetch to sync IDs and server timestamps
        fetchConversations(true);
      }
    } catch (err) {
      console.error('[Send Message Error]:', err);
    } finally {
      setIsSending(false);
    }
  };

  // Toggle AI Bot Mode (Autonomous Bot ↔ Human Takeover)
  const handleToggleAiMode = async () => {
    if (!activeConversation || isTogglingAi) return;

    const nextMode = !activeConversation.is_ai_active;
    setIsTogglingAi(true);

    // Optimistic update
    setConversations((prev) =>
      prev.map((c) => (c.id === activeConversation.id ? { ...c, is_ai_active: nextMode } : c))
    );

    try {
      await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConversation.id,
          isAiActive: nextMode
        })
      });
      fetchConversations(true);
    } catch (err) {
      console.error('[Toggle AI Mode Error]:', err);
    } finally {
      setIsTogglingAi(false);
    }
  };

  // Reset Customer Funnel Session State
  const handleResetSession = async () => {
    if (!activeConversation || isResettingSession) return;
    if (!confirm('Are you sure you want to reset this customer bot flow to the Welcome Menu?')) return;

    setIsResettingSession(true);
    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConversation.id,
          action: 'RESET_SESSION'
        })
      });
      if (res.ok) {
        fetchConversations(true);
      }
    } catch (err) {
      console.error('[Reset Session Error]:', err);
    } finally {
      setIsResettingSession(false);
    }
  };

  // Update Customer Status Tag (VIP / REGULAR / FLAGGED)
  const handleUpdateStatusTag = async (newTag: 'VIP' | 'REGULAR' | 'FLAGGED') => {
    if (!activeConversation?.user?.id) return;
    try {
      await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_TAG',
          userId: activeConversation.user.id,
          statusTag: newTag
        })
      });
      fetchConversations(true);
    } catch (err) {
      console.error('[Update Status Tag Error]:', err);
    }
  };

  // Copy helper
  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Format relative timestamps
  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const now = Date.now();
      const diffSec = Math.floor((now - new Date(isoString).getTime()) / 1000);
      if (diffSec < 60) return 'Just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      return `${Math.floor(diffSec / 86400)}d ago`;
    } catch {
      return '';
    }
  };

  // Funnel Step Badge Details
  const getStepBadge = (step?: string) => {
    switch (step) {
      case 'SELECTING_GAME':
        return { label: 'Browsing Games', bg: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
      case 'SELECTING_PACKAGE':
        return { label: 'Picking Package', bg: 'bg-purple-500/10 text-purple-400 border-purple-500/30' };
      case 'COLLECTING_UID':
        return { label: 'Entering UID', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
      case 'AWAITING_PAYMENT':
        return { label: 'Awaiting Payment', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse' };
      case 'AWAITING_VERIFICATION_CODE':
        return { label: 'Waiting OTP/Code', bg: 'bg-rose-500/15 text-rose-300 border-rose-500/30' };
      case 'ORDER_PLACED':
        return { label: 'Order Placed', bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
      default:
        return { label: 'Idle / Ready', bg: 'bg-slate-800 text-slate-400 border-slate-700' };
    }
  };

  // Aggregate Stats
  const stats = useMemo(() => {
    const total = conversations.length;
    let botCount = 0;
    let humanCount = 0;
    let activeFunnelCount = 0;

    for (const c of conversations) {
      if (c.is_ai_active) botCount++;
      else humanCount++;
      const step = c.draft_state?.step || c.session_state?.step || 'IDLE';
      if (step !== 'IDLE') activeFunnelCount++;
    }

    return { total, botCount, humanCount, activeFunnelCount };
  }, [conversations]);

  return (
    <div className="flex-1 flex flex-col h-full max-h-full min-h-0 overflow-hidden bg-dark-950">
      {/* Top Operations Header */}
      <div className="shrink-0">
        <Header
          title="Live Customer Chat & Bot Inbox"
          subtitle="Manage WhatsApp live customer streams, autonomous bot sessions, and human agent takeover"
        />
      </div>

      {/* Control Bar & Stats Ribbon */}
      <div className="bg-dark-900/90 border-b border-slate-800/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 z-10">
        {/* Left: Summary Metrics */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/60 font-semibold text-slate-200">
            <MessageSquare className="w-3.5 h-3.5 text-brand-400" />
            <span>{stats.total} Conversations</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold">
            <Bot className="w-3.5 h-3.5" />
            <span>{stats.botCount} Bot Handled</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-semibold">
            <User className="w-3.5 h-3.5" />
            <span>{stats.humanCount} Human Takeover</span>
          </div>

          {stats.activeFunnelCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>{stats.activeFunnelCount} in Active Checkout</span>
            </div>
          )}
        </div>

        {/* Right: Sound, Auto-Refresh & Drawer Toggles */}
        <div className="flex items-center gap-2">
          {/* Sound Alert Toggle */}
          <button
            onClick={() => setSoundEnabled((v) => !v)}
            title={soundEnabled ? 'Mute Audio Alerts' : 'Enable Audio Alerts'}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition ${
              soundEnabled
                ? 'bg-brand-500/15 text-brand-300 border-brand-500/30'
                : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-slate-200'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-brand-400" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">{soundEnabled ? 'Sound On' : 'Muted'}</span>
          </button>

          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition ${
              autoRefresh
                ? 'bg-slate-800/80 text-emerald-400 border-slate-700/80'
                : 'bg-slate-800/40 text-slate-400 border-slate-800'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span>{autoRefresh ? 'Live (4s)' : 'Paused'}</span>
          </button>

          {/* Manual Refresh Button */}
          <button
            onClick={() => fetchConversations(false)}
            disabled={loading}
            title="Refresh Conversations"
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-400' : ''}`} />
          </button>

          {/* Context Details Toggle */}
          <button
            onClick={() => setShowRightDrawer((v) => !v)}
            title="Toggle Customer Profile & Orders"
            className={`hidden xl:flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition ${
              showRightDrawer
                ? 'bg-slate-800/90 text-slate-200 border-slate-700'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <Info className="w-3.5 h-3.5 text-indigo-400" />
            <span>Details</span>
          </button>
        </div>
      </div>

      {/* Main 3-Column Layout Workspace */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {/* ========================================================================= */}
        {/* COLUMN 1: Inbox List & Upcoming Chats */}
        {/* ========================================================================= */}
        <div
          className={`${
            showMobileDetail ? 'hidden' : 'flex'
          } lg:flex w-full lg:w-80 xl:w-96 flex-col border-r border-slate-800/80 bg-dark-900/60 shrink-0 h-full min-h-0 overflow-hidden`}
        >
          {/* Search Box */}
          <div className="p-3 border-b border-slate-800/80 space-y-2.5 shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search phone, name, UID or message..."
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[11px]">
              {(
                [
                  { id: 'ALL', label: 'All' },
                  { id: 'ACTIVE_FUNNEL', label: 'In Checkout' },
                  { id: 'BOT_ACTIVE', label: 'Bot' },
                  { id: 'HUMAN_MODE', label: 'Human' },
                  { id: 'VIP', label: 'VIP' }
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterTab(tab.id)}
                  className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition ${
                    filterTab === tab.id
                      ? 'bg-brand-500/20 text-brand-300 border border-brand-500/40 font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation List Stream */}
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-800/40">
            {loading && conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin text-brand-500 mb-2" />
                <span>Loading live customer streams...</span>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs space-y-2">
                <MessageSquare className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="font-semibold text-slate-400">No matching conversations</p>
                <p className="text-[11px] text-slate-500">
                  {searchQuery ? 'Try clearing your search query' : 'Incoming WhatsApp messages will appear here live'}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.id === activeConversation?.id;
                const user = conv.user;
                const phone = user?.phone_number || (conv as any).phone || 'Customer';
                const name = user?.name || phone;
                const step = conv.draft_state?.step || conv.session_state?.step || 'IDLE';
                const stepInfo = getStepBadge(step);
                const lastMsg = conv.messages?.[conv.messages.length - 1];
                const isVip = user?.status_tag === 'VIP' || user?.customer_profile?.vip_status;
                const isFlagged = user?.status_tag === 'FLAGGED';

                return (
                  <div
                    key={conv.id}
                    onClick={() => {
                      setSelectedConvId(conv.id);
                      setShowMobileDetail(true);
                    }}
                    className={`p-3 cursor-pointer transition-all duration-150 relative ${
                      isSelected
                        ? 'bg-gradient-to-r from-brand-500/15 via-slate-800/60 to-slate-800/40 border-l-4 border-l-brand-400'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar with Status indicator */}
                      <div className="relative shrink-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shadow-md ${
                            isVip
                              ? 'bg-gradient-to-tr from-amber-500 to-yellow-600 text-slate-950 font-black'
                              : isFlagged
                              ? 'bg-gradient-to-tr from-rose-600 to-red-700 text-white'
                              : 'bg-gradient-to-tr from-slate-700 to-slate-800 text-slate-200 border border-slate-700'
                          }`}
                        >
                          {name ? name.slice(0, 2).toUpperCase() : 'CU'}
                        </div>
                        {/* Channel badge */}
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center">
                          <WhatsAppIcon className="w-2.5 h-2.5 text-emerald-400" />
                        </div>
                      </div>

                      {/* Summary Text Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-semibold text-xs text-white truncate">{name}</span>
                            {isVip && (
                              <span className="text-[9px] uppercase font-black px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                                VIP
                              </span>
                            )}
                            {isFlagged && (
                              <span className="text-[9px] uppercase font-black px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                FLAGGED
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {formatRelativeTime(conv.last_message_at || lastMsg?.created_at)}
                          </span>
                        </div>

                        {/* Phone Number */}
                        <div className="text-[11px] text-slate-400 truncate mb-1">{phone}</div>

                        {/* Last Message Snippet */}
                        <div className="text-[11px] text-slate-400 truncate mb-1.5">
                          {lastMsg ? (
                            <>
                              <span
                                className={`font-medium mr-1 ${
                                  lastMsg.sender === 'CUSTOMER'
                                    ? 'text-slate-300'
                                    : lastMsg.sender === 'BOT'
                                    ? 'text-emerald-400'
                                    : 'text-indigo-400'
                                }`}
                              >
                                {lastMsg.sender === 'CUSTOMER' ? '' : lastMsg.sender === 'BOT' ? 'Bot:' : 'Admin:'}
                              </span>
                              <span>{lastMsg.content}</span>
                            </>
                          ) : (
                            <span className="italic text-slate-600">No messages yet</span>
                          )}
                        </div>

                        {/* Status Tags Row */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Funnel Step Badge */}
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${stepInfo.bg}`}>
                            {stepInfo.label}
                          </span>

                          {/* Bot or Human Mode Badge */}
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                              conv.is_ai_active
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                            }`}
                          >
                            {conv.is_ai_active ? <Bot className="w-2.5 h-2.5" /> : <User className="w-2.5 h-2.5" />}
                            <span>{conv.is_ai_active ? 'Bot Active' : 'Human Takeover'}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 2: Center Live Chat Thread */}
        {/* ========================================================================= */}
        <div
          className={`${
            showMobileDetail ? 'flex' : 'hidden'
          } lg:flex flex-1 flex-col h-full min-h-0 bg-dark-950/70 overflow-hidden min-w-0`}
        >
          {activeConversation ? (
            <>
              {/* Active Conversation Header */}
              <div className="p-3.5 border-b border-slate-800/80 bg-dark-900/80 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => setShowMobileDetail(false)}
                    className="lg:hidden p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  {/* Customer Info */}
                  <div className="overflow-hidden">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-white truncate">
                        {activeConversation.user?.name || (activeConversation as any).phone || 'Customer'}
                      </h3>

                      {activeConversation.user?.status_tag === 'VIP' && (
                        <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                          VIP
                        </span>
                      )}

                      {/* WhatsApp Direct Jump */}
                      <a
                        href={`https://wa.me/${(
                          activeConversation.user?.phone_number ||
                          (activeConversation as any).phone ||
                          ''
                        ).replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 hover:border-emerald-500/40 transition"
                      >
                        <WhatsAppIcon className="w-3 h-3" />
                        <span className="font-mono">
                          {activeConversation.user?.phone_number || (activeConversation as any).phone}
                        </span>
                        <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                      </a>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span>Channel: WhatsApp Business</span>
                      <span>•</span>
                      <span>Total Orders: {activeConversation.user?.customer_profile?.total_completed_orders || customerOrders.length || 0}</span>
                    </div>
                  </div>
                </div>

                {/* AI Bot Takeover Switch & Reset */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Human Takeover vs AI Switch */}
                  <div className="flex items-center gap-2 p-1 pl-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      {activeConversation.is_ai_active ? (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <Bot className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Bot Auto-Reply</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-400">
                          <User className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Human Takeover</span>
                        </span>
                      )}
                    </div>

                    <button
                      onClick={handleToggleAiMode}
                      disabled={isTogglingAi}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        activeConversation.is_ai_active ? 'bg-emerald-500' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          activeConversation.is_ai_active ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Reset Bot Session Button */}
                  <button
                    onClick={handleResetSession}
                    disabled={isResettingSession}
                    title="Reset customer flow to Welcome Menu"
                    className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-amber-400 border border-slate-700 transition"
                  >
                    <RotateCcw className={`w-4 h-4 ${isResettingSession ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Bot State Notification Banner */}
              {!activeConversation.is_ai_active ? (
                <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-1.5 flex items-center justify-between text-xs text-amber-300 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      <strong>Human Takeover Active:</strong> The AI Bot is currently paused for this customer. Only your
                      messages will be sent.
                    </span>
                  </div>
                  <button
                    onClick={handleToggleAiMode}
                    className="underline text-[11px] hover:text-amber-200 font-bold ml-2"
                  >
                    Resume Bot
                  </button>
                </div>
              ) : (
                <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-1 flex items-center justify-between text-[11px] text-emerald-300 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Autonomous State Bot is responding to messages in real-time.</span>
                  </div>
                  <button
                    onClick={handleToggleAiMode}
                    className="text-slate-400 hover:text-emerald-200 underline font-medium"
                  >
                    Take Over Chat
                  </button>
                </div>
              )}

              {/* Messages History Stream */}
              <div
                ref={messageContainerRef}
                className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 bg-gradient-to-b from-dark-950 via-dark-950 to-black"
              >
                {activeConversation.messages?.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-8 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-brand-400">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-300 text-sm">Conversation initialized</p>
                      <p className="text-xs text-slate-500 mt-1">
                        When the customer sends a WhatsApp message or bot responds, the complete log will appear here.
                      </p>
                    </div>
                  </div>
                ) : (
                  activeConversation.messages?.map((msg, index) => {
                    const isCustomer = msg.sender === 'CUSTOMER';
                    const isBot = msg.sender === 'BOT';
                    const isAdmin = msg.sender === 'ADMIN';

                    return (
                      <div
                        key={msg.id || index}
                        className={`flex flex-col ${isCustomer ? 'items-start' : isAdmin ? 'items-end' : 'items-start'}`}
                      >
                        {/* Sender Label & Timestamp */}
                        <div className="flex items-center gap-2 mb-1 px-1 text-[11px] text-slate-400">
                          {isCustomer ? (
                            <span className="font-bold text-slate-300 flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-400" />
                              {activeConversation.user?.name || 'Customer'}
                            </span>
                          ) : isBot ? (
                            <span className="font-bold text-emerald-400 flex items-center gap-1">
                              <Bot className="w-3 h-3 text-emerald-400" />
                              DS Dukan Bot
                            </span>
                          ) : (
                            <span className="font-bold text-brand-300 flex items-center gap-1">
                              <Shield className="w-3 h-3 text-brand-400" />
                              Admin
                            </span>
                          )}
                          <span>•</span>
                          <span>{formatTime(msg.created_at)}</span>
                        </div>

                        {/* Bubble Content */}
                        <div
                          className={`max-w-[85%] sm:max-w-lg rounded-2xl p-3.5 text-xs shadow-md ${
                            isCustomer
                              ? 'bg-slate-900 border border-slate-800/90 text-slate-100 rounded-tl-xs'
                              : isBot
                              ? 'bg-emerald-950/25 border border-emerald-500/30 text-emerald-100 rounded-tl-xs backdrop-blur-sm'
                              : 'bg-gradient-to-r from-brand-600 via-emerald-600 to-teal-600 text-white rounded-tr-xs shadow-brand-500/10'
                          }`}
                        >
                          {/* Raw Button or Interactive Selection Indicator */}
                          {Boolean(msg.raw_payload?.button_id) && (
                            <div className="mb-2 px-2 py-1 rounded bg-slate-950/60 border border-slate-800 text-[10px] text-brand-300 font-mono inline-block">
                              Button Choice: {String(msg.raw_payload?.button_id)}
                            </div>
                          )}

                          {/* Message Content with link parsing */}
                          <div className="whitespace-pre-wrap leading-relaxed break-words font-sans">
                            {msg.content}
                          </div>

                          {/* Highlight ZiniPay Link / Payment Card if present */}
                          {(msg.content.includes('checkout.zinipay.com') ||
                            msg.raw_payload?.type === 'payment_invoice') && (
                            <div className="mt-2.5 p-2 rounded-xl bg-slate-950/70 border border-emerald-500/40 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <CreditCard className="w-4 h-4 text-emerald-400" />
                                <span className="font-bold text-[11px] text-emerald-300">ZiniPay Instant Checkout</span>
                              </div>
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono font-bold">
                                Auto-Verify
                              </span>
                            </div>
                          )}

                          {/* Delivery Confirmation */}
                          {isAdmin && (
                            <div className="mt-1 flex items-center justify-end text-[10px] text-emerald-200/80 gap-1">
                              <CheckCheck className="w-3.5 h-3.5 text-emerald-300" />
                              <span>Sent via WhatsApp Cloud API</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Canned Response Pills */}
              <div className="bg-dark-900/90 border-t border-slate-800/80 px-4 py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[11px]">
                <span className="text-slate-500 font-bold uppercase text-[9px] mr-1 shrink-0 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-brand-400" /> Fast Reply:
                </span>
                {CANNED_RESPONSES.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => setMessageInput(item.text)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 whitespace-nowrap transition shrink-0 active:scale-95"
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Chat Input Box */}
              <div className="p-3 bg-dark-900 border-t border-slate-800/90 shrink-0">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-end gap-2"
                >
                  <div className="flex-1 relative">
                    <textarea
                      rows={2}
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder={`Reply to ${
                        activeConversation.user?.name || 'customer'
                      } via WhatsApp Business Cloud... (Press Enter to Send)`}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 resize-none transition"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!messageInput.trim() || isSending}
                    className="h-10 px-4 rounded-xl bg-gradient-to-r from-brand-500 to-emerald-600 hover:from-brand-600 hover:to-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition shrink-0 active:scale-95"
                  >
                    <Send className={`w-3.5 h-3.5 ${isSending ? 'animate-pulse' : ''}`} />
                    <span className="hidden sm:inline">Send WhatsApp</span>
                  </button>
                </form>

                <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <WhatsAppIcon className="w-2.5 h-2.5 text-emerald-400" />
                    Messages deliver straight to customer's WhatsApp screen.
                  </span>
                  <span>Shift + Enter for new line</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
              <MessageSquare className="w-12 h-12 text-slate-700 mb-3" />
              <h3 className="font-bold text-base text-slate-300">Select a Conversation</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Choose a customer from the left list to view their live WhatsApp messages, bot responses, and order
                history.
              </p>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 3: Right Context Drawer (Customer & Funnel Intelligence) */}
        {/* ========================================================================= */}
        {showRightDrawer && activeConversation && (
          <div className="hidden xl:flex w-80 flex-col border-l border-slate-800/80 bg-dark-900/80 backdrop-blur-md overflow-y-auto shrink-0 p-4 space-y-4 h-full min-h-0">
            {/* Header / Close */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-indigo-400" />
                Customer Intelligence
              </h4>
              <button
                onClick={() => setShowRightDrawer(false)}
                className="text-slate-500 hover:text-slate-300 p-1"
                title="Hide Context"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Live Funnel State Card */}
            {(() => {
              const draft = activeConversation.draft_state?.draftOrder;
              const step = activeConversation.draft_state?.step || 'IDLE';
              const stepBadge = getStepBadge(step);

              return (
                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-amber-400" /> Funnel Session
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${stepBadge.bg}`}>
                      {stepBadge.label}
                    </span>
                  </div>

                  {draft && (draft.selectedGame || draft.items?.length || draft.playerUid) ? (
                    <div className="space-y-2 text-xs divide-y divide-slate-800/50">
                      {draft.selectedGameLabel && (
                        <div className="pt-1.5 flex justify-between">
                          <span className="text-slate-400">Game:</span>
                          <span className="font-bold text-white text-right">{draft.selectedGameLabel}</span>
                        </div>
                      )}

                      {draft.items?.[0] && (
                        <div className="pt-1.5 flex justify-between">
                          <span className="text-slate-400">Package:</span>
                          <span className="font-bold text-brand-300 text-right">
                            {draft.items[0].productName || draft.items[0].skuOrName} (৳{draft.items[0].unitPrice || draft.totalAmount})
                          </span>
                        </div>
                      )}

                      {draft.playerUid && (
                        <div className="pt-1.5 flex items-center justify-between">
                          <span className="text-slate-400">Player UID:</span>
                          <div className="flex items-center gap-1">
                            <span className="font-mono font-bold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                              {draft.playerUid}
                            </span>
                            <button
                              onClick={() => copyToClipboard(draft.playerUid!, 'uid')}
                              className="p-1 text-slate-400 hover:text-white"
                              title="Copy UID"
                            >
                              {copiedText === 'uid' ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {draft.trxId && (
                        <div className="pt-1.5 flex items-center justify-between">
                          <span className="text-slate-400">TrxID:</span>
                          <span className="font-mono font-bold text-emerald-400">{draft.trxId}</span>
                        </div>
                      )}

                      {draft.paymentUrl && (
                        <div className="pt-2">
                          <a
                            href={draft.paymentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full py-1.5 px-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-center block text-[11px] transition"
                          >
                            Open ZiniPay Invoice 💳
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500 italic">Customer has no active pending draft order.</div>
                  )}

                  {/* Reset Flow Button */}
                  <button
                    onClick={handleResetSession}
                    disabled={isResettingSession}
                    className="w-full py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-300 border border-slate-800 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Flow to Welcome Menu</span>
                  </button>
                </div>
              );
            })()}

            {/* Customer Profile & Tag Selector */}
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
              <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-brand-400" /> Customer Profile
              </span>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Name:</span>
                  <span className="font-semibold text-white truncate max-w-[150px]">
                    {activeConversation.user?.name || 'Customer'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">Phone:</span>
                  <span className="font-mono font-medium text-slate-200">
                    {activeConversation.user?.phone_number || (activeConversation as any).phone}
                  </span>
                </div>

                {activeConversation.user?.customer_profile?.last_used_uid && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Last UID:</span>
                    <span className="font-mono text-slate-300">
                      {activeConversation.user.customer_profile.last_used_uid}
                    </span>
                  </div>
                )}
              </div>

              {/* Status Tag Selector */}
              <div className="pt-2 border-t border-slate-800/80">
                <label className="text-[10px] text-slate-400 font-semibold mb-1 block">Customer Tag:</label>
                <div className="grid grid-cols-3 gap-1 text-[10px]">
                  {(['VIP', 'REGULAR', 'FLAGGED'] as const).map((tag) => {
                    const currentTag = activeConversation.user?.status_tag || 'REGULAR';
                    const isTagActive = currentTag === tag;

                    return (
                      <button
                        key={tag}
                        onClick={() => handleUpdateStatusTag(tag)}
                        className={`py-1 rounded font-bold transition text-center ${
                          isTagActive
                            ? tag === 'VIP'
                              ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                              : tag === 'FLAGGED'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-900 text-slate-500 hover:text-slate-300 border border-slate-800'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Customer's Recent Orders */}
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                  <ShoppingBag className="w-3.5 h-3.5 text-brand-400" /> Recent Orders
                </span>
                <Link href="/orders" className="text-[10px] text-brand-400 hover:underline">
                  All Orders →
                </Link>
              </div>

              {loadingOrders ? (
                <div className="py-4 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-400" />
                  <span>Loading orders...</span>
                </div>
              ) : customerOrders.length === 0 ? (
                <div className="text-[11px] text-slate-500 italic py-2 text-center">No orders placed yet.</div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {customerOrders.map((ord) => (
                    <div
                      key={ord.id || ord.order_id}
                      className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-1 hover:border-slate-700 transition"
                    >
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <span className="font-bold text-white">#{ord.order_id}</span>
                        <span className="font-bold text-brand-400">৳{ord.total_amount}</span>
                      </div>

                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-400 truncate max-w-[120px]">
                          {ord.items?.[0]?.product_name || 'Game Package'}
                        </span>
                        <span
                          className={`font-semibold px-1.5 py-0.2 rounded ${
                            ord.status === 'DELIVERED'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : ord.status === 'PROCESSING' || ord.status === 'CLAIMED'
                              ? 'bg-blue-500/15 text-blue-400'
                              : ord.status === 'CANCELLED'
                              ? 'bg-rose-500/15 text-rose-400'
                              : 'bg-amber-500/15 text-amber-400'
                          }`}
                        >
                          {ord.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
