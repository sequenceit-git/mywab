'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import {
  ShoppingBag,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Truck,
  Send,
  User,
  Phone,
  MapPin,
  RefreshCw,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Ban,
  X,
  ExternalLink
} from 'lucide-react';
import { Order, OrderStatus } from '@/types';
import { getAccountFieldInfo } from '@/lib/chat/input-parser';
import { WhatsAppIcon, TelegramIcon, BkashIcon, NagadIcon, RocketIcon } from '@/components/BrandIcons';

const ITEMS_PER_PAGE = 10;

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showMobileDetail, setShowMobileDetail] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);

  // Cancel Order Modal State
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders', {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (data.success && Array.isArray(data.orders)) {
          setOrders(data.orders);
          if (!selectedOrder && data.orders.length > 0) {
            setSelectedOrder(data.orders[0]);
          } else if (selectedOrder) {
            // Keep selected order updated
            const updated = data.orders.find((o: Order) => o.id === selectedOrder.id || o.order_id === selectedOrder.order_id);
            if (updated) setSelectedOrder(updated);
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 4000);
    return () => clearInterval(interval);
  }, []);

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus]);

  const handleUpdateStatus = async (orderIdCode: string, newStatus: OrderStatus, reason?: string) => {
    try {
      const res = await fetch(`/api/orders/${orderIdCode}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ status: newStatus, reason }),
      });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        if (data.success) {
          fetchOrders();
          if (selectedOrder?.order_id === orderIdCode) {
            setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
          }
        }
      }
    } catch (e) {
      console.error('Failed to update status:', e);
    }
  };

  const handleConfirmCancelOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingOrder) return;
    setIsCancelling(true);

    try {
      await handleUpdateStatus(cancellingOrder.order_id, 'CANCELLED', cancellationReason.trim() || 'অ্যাডমিন কর্তৃক বাতিল করা হয়েছে (Cancelled by Admin)');
      setCancellingOrder(null);
      setCancellationReason('');
    } catch (err) {
      console.error('Error cancelling order:', err);
    } finally {
      setIsCancelling(false);
    }
  };

  const filteredOrders = orders.filter(o => {
    const matchesFilter = filterStatus === 'ALL' || o.status === filterStatus;
    const matchesSearch =
      o.order_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.delivery_phone.includes(searchQuery) ||
      (o.player_uid && o.player_uid.includes(searchQuery)) ||
      (o.trx_id && o.trx_id.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (o.customer?.name && o.customer.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (o.delivery_address?.address && o.delivery_address.address.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  // Pagination Calculations
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

  const getPaymentIcon = (method?: string) => {
    const m = (method || '').toLowerCase();
    if (m.includes('bkash')) return <BkashIcon className="w-3.5 h-3.5" />;
    if (m.includes('nagad')) return <NagadIcon className="w-3.5 h-3.5" />;
    if (m.includes('rocket')) return <RocketIcon className="w-3.5 h-3.5" />;
    return <BkashIcon className="w-3.5 h-3.5" />;
  };

  const renderDetailPanel = (isModal = false) => {
    if (!selectedOrder) {
      return (
        <div className="p-8 rounded-2xl bg-dark-900/50 border border-slate-800/60 text-center text-xs text-slate-500">
          Select an order from the list to view full details and actions.
        </div>
      );
    }

    const selProd = selectedOrder.items?.[0]?.product_name || '';
    const selUid = selectedOrder.player_uid || selectedOrder.delivery_address?.name || 'N/A';
    const selAccInfo = getAccountFieldInfo(selUid, selProd);
    const cleanPhone = (selectedOrder.delivery_phone || '').replace(/\D/g, '');

    return (
      <div className={`p-4 sm:p-5 rounded-2xl bg-dark-900/95 border border-slate-800/80 space-y-4 shadow-2xl ${isModal ? 'max-h-[85vh] overflow-y-auto' : 'sticky top-24'}`}>
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Top-Up Order</span>
            <h3 className="text-sm font-bold text-white font-mono">{selectedOrder.order_id}</h3>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                selectedOrder.status === 'PENDING_CLAIM'
                  ? 'status-badge-pending'
                  : selectedOrder.status === 'DELIVERED'
                  ? 'status-badge-delivered'
                  : selectedOrder.status === 'CANCELLED'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'status-badge-claimed'
              }`}
            >
              {selectedOrder.status}
            </span>
            {isModal && (
              <button
                onClick={() => setShowMobileDetail(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white bg-slate-800/80"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Account / UID & Top-up details */}
        <div className="p-3 rounded-xl bg-slate-950/80 border border-brand-500/30 space-y-1.5 text-xs">
          <div className="text-[10px] uppercase font-bold text-brand-400">{selAccInfo.emoji} {selAccInfo.labelEn}</div>
          <div className="text-base font-mono font-black text-white tracking-wider break-all">
            {selUid}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap pt-0.5">
            <div className="flex items-center gap-1.5 shrink-0">
              {getPaymentIcon(selectedOrder.payment_method)}
              <span className="font-semibold text-slate-200">{selectedOrder.payment_method || 'bKash/Nagad/Rocket'}</span>
            </div>
            <span className="text-slate-600">|</span>
            <div>
              <span>TrxID: </span>
              <b className="font-mono text-emerald-400 font-semibold">{selectedOrder.trx_id || 'N/A'}</b>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Top-Up / Subscription Packages</h4>
          <div className="space-y-1.5">
            {selectedOrder.items?.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/50">
                <div className="pr-2">
                  <div className="text-slate-200 font-semibold">{item.product_name}</div>
                  <div className="text-[10px] text-slate-400">Qty: {item.quantity} × ৳{item.unit_price}</div>
                </div>
                <div className="font-bold text-brand-400 whitespace-nowrap">৳{item.subtotal}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Customer Info */}
        <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Customer Details</h4>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/50 space-y-2 text-slate-300">
            <div className="flex items-center justify-between">
              <div><b>Phone:</b> {selectedOrder.delivery_phone}</div>
              <a
                href={`https://wa.me/${cleanPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/15 text-emerald-400 text-[10px] font-semibold hover:bg-emerald-500/25 border border-emerald-500/30"
              >
                <WhatsAppIcon className="w-3 h-3" />
                Chat
              </a>
            </div>
            {selectedOrder.customer_notes && (
              <div className="text-amber-400 text-[11px] pt-1 border-t border-slate-800/40"><b>Notes:</b> {selectedOrder.customer_notes}</div>
            )}
          </div>
        </div>

        {/* Worker Assignment */}
        <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Telegram Dispatch</h4>
          <div className="p-3 rounded-xl bg-telegram-500/10 border border-telegram-500/20 text-xs space-y-1">
            <div className="text-telegram-500 font-semibold flex items-center gap-1.5">
              <TelegramIcon className="w-3.5 h-3.5 shrink-0" />
              <span>{selectedOrder.current_worker ? `Claimed by: ${selectedOrder.current_worker.full_name}` : 'Dispatched to Worker Group (Pending Claim)'}</span>
            </div>
            {selectedOrder.current_worker?.telegram_username && (
              <div className="text-[11px] text-slate-400 font-mono">@{selectedOrder.current_worker.telegram_username}</div>
            )}
          </div>
        </div>

        {/* Action Controls & Cancel Option */}
        <div className="pt-2 border-t border-slate-800 space-y-2">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Admin Actions</h4>
          
          {selectedOrder.status !== 'CANCELLED' ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    handleUpdateStatus(selectedOrder.order_id, 'PROCESSING');
                    if (isModal) setShowMobileDetail(false);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition text-center"
                >
                  Processing
                </button>
                <button
                  onClick={() => {
                    handleUpdateStatus(selectedOrder.order_id, 'DELIVERED');
                    if (isModal) setShowMobileDetail(false);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-xs font-bold text-dark-950 transition shadow-sm text-center"
                >
                  Mark Delivered
                </button>
              </div>

              <button
                onClick={() => {
                  setCancellingOrder(selectedOrder);
                  setCancellationReason('');
                  if (isModal) setShowMobileDetail(false);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 hover:text-rose-300 text-xs font-bold flex items-center justify-center gap-2 transition"
              >
                <Ban className="w-4 h-4" />
                <span>Cancel Order</span>
              </button>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-xs text-rose-300 space-y-1 text-center">
              <div className="font-bold flex items-center justify-center gap-1.5">
                <Ban className="w-3.5 h-3.5" />
                <span>Order Cancelled</span>
              </div>
              <div className="text-[11px] text-slate-400">This order is cancelled and worker assignment released.</div>
              <button
                onClick={() => {
                  handleUpdateStatus(selectedOrder.order_id, 'PENDING_CLAIM');
                  if (isModal) setShowMobileDetail(false);
                }}
                className="mt-2 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 transition"
              >
                Reopen to Pending Claim
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-950">
      <Header
        title="DS Dukan Orders & Fulfillment"
        subtitle="Live tracking of top-ups & subscriptions, worker claims, customer dispatch, and cancellations"
      />

      <main className="p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-4 sm:space-y-6 pb-20 lg:pb-6">
        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-dark-900/90 border border-slate-800/80 shadow-lg">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Order ID, UID, Email, TrxID, Phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500/50"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {['ALL', 'PENDING_CLAIM', 'CLAIMED', 'PROCESSING', 'DELIVERED', 'CANCELLED'].map((status) => {
              const isSelected = filterStatus === status;
              return (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    isSelected
                      ? status === 'CANCELLED'
                        ? 'bg-rose-500 text-white shadow-sm'
                        : 'bg-brand-500 text-dark-950 shadow-sm'
                      : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {status === 'ALL' ? `ALL (${orders.length})` : status.replace('_', ' ')}
                </button>
              );
            })}
          </div>
        </div>

        {/* Master-Detail Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order List */}
          <div className="lg:col-span-2 space-y-3">
            {loading ? (
              <div className="py-16 text-center text-slate-500 text-xs">Loading orders...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-xs bg-dark-900/50 rounded-2xl border border-slate-800/60">
                No orders match the selected filter criteria.
              </div>
            ) : (
              paginatedOrders.map((order) => {
                const isSelected = selectedOrder?.id === order.id || selectedOrder?.order_id === order.order_id;
                const playerUid = order.player_uid || order.delivery_address?.name || 'N/A';
                const isCancelled = order.status === 'CANCELLED';
                const productName = order.items?.[0]?.product_name || '';
                const accInfo = getAccountFieldInfo(playerUid, productName);

                return (
                  <div
                    key={order.id || order.order_id}
                    onClick={() => {
                      setSelectedOrder(order);
                      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                        setShowMobileDetail(true);
                      }
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? isCancelled
                          ? 'bg-rose-950/20 border-rose-500/50 shadow-lg shadow-rose-500/5 ring-1 ring-rose-500/30'
                          : 'bg-slate-900 border-brand-500/50 shadow-lg shadow-brand-500/5 ring-1 ring-brand-500/30'
                        : isCancelled
                        ? 'bg-dark-900/60 border-rose-900/40 opacity-75 hover:opacity-100 hover:border-rose-800'
                        : 'bg-dark-900/90 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white">{order.order_id}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            order.status === 'PENDING_CLAIM'
                              ? 'status-badge-pending'
                              : order.status === 'DELIVERED'
                              ? 'status-badge-delivered'
                              : order.status === 'CANCELLED'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'status-badge-claimed'
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>
                      <span className={`text-sm font-extrabold ${isCancelled ? 'text-slate-400 line-through' : 'text-brand-400'}`}>
                        ৳{order.total_amount}
                      </span>
                    </div>

                    <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
                      <div className="flex items-center gap-1.5 font-mono text-emerald-400 truncate">
                        <span>{accInfo.emoji} {accInfo.labelEn}: <b className="text-emerald-300">{playerUid}</b></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{order.delivery_phone}</span>
                      </div>
                      <div className="sm:col-span-2 flex items-center gap-2 text-[11px] text-slate-300">
                        <div className="flex items-center gap-1.5 shrink-0">
                          {getPaymentIcon(order.payment_method)}
                          <span className="font-semibold text-slate-200">{order.payment_method || 'bKash/Nagad/Rocket'}</span>
                        </div>
                        <span className="text-slate-600">|</span>
                        <div className="truncate">
                          <span>TrxID: </span>
                          <b className="font-mono text-emerald-400 font-semibold">{order.trx_id || 'N/A'}</b>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="truncate pr-2">Worker: <b className="text-slate-200">{order.current_worker?.full_name || 'Unassigned (Waiting in Telegram)'}</b></span>
                      <div className="flex items-center gap-3 shrink-0">
                        <span>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {!isCancelled && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCancellingOrder(order);
                              setCancellationReason('');
                            }}
                            className="text-[10px] text-rose-400 hover:text-rose-300 hover:underline flex items-center gap-1"
                          >
                            <Ban className="w-3 h-3" />
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Pagination Controls */}
            {filteredOrders.length > 0 && (
              <div className="p-3.5 sm:p-4 rounded-2xl bg-dark-900/90 border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="text-slate-400 text-center sm:text-left">
                  Showing <span className="font-semibold text-white">{startIndex + 1}</span> to{' '}
                  <span className="font-semibold text-white">{Math.min(endIndex, filteredOrders.length)}</span> of{' '}
                  <span className="font-semibold text-white">{filteredOrders.length}</span> orders
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-xl text-xs font-bold transition ${
                          currentPage === pageNum
                            ? 'bg-brand-500 text-dark-950 shadow-sm'
                            : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        {pageNum}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    title="Next Page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Desktop Order Detail Panel */}
          <div className="hidden lg:block space-y-4">
            {renderDetailPanel(false)}
          </div>
        </div>

        {/* Mobile Slide-up Order Detail Modal */}
        {showMobileDetail && selectedOrder && (
          <div className="lg:hidden fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="w-full max-w-lg bg-dark-900 rounded-t-3xl sm:rounded-3xl border border-slate-800 shadow-2xl p-1 animate-in slide-in-from-bottom duration-200">
              <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto my-2 sm:hidden"></div>
              {renderDetailPanel(true)}
            </div>
          </div>
        )}

        {/* Modal: Cancel Order Confirmation */}
        {cancellingOrder && (() => {
          const cancelProd = cancellingOrder.items?.[0]?.product_name || '';
          const cancelUid = cancellingOrder.player_uid || cancellingOrder.delivery_address?.name || 'N/A';
          const cancelAccInfo = getAccountFieldInfo(cancelUid, cancelProd);

          return (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-dark-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2 text-rose-400">
                    <ShieldAlert className="w-5 h-5" />
                    <h3 className="text-sm font-bold text-white">Cancel Order</h3>
                  </div>
                  <button
                    onClick={() => setCancellingOrder(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="text-slate-400">Order ID: <b className="text-white font-mono">{cancellingOrder.order_id}</b></div>
                    <div className="text-slate-400">{cancelAccInfo.labelEn}: <b className="text-emerald-400 font-mono break-all">{cancelUid}</b></div>
                    <div className="text-slate-400">Amount: <b className="text-brand-400">৳{cancellingOrder.total_amount}</b></div>
                  </div>

                  <form onSubmit={handleConfirmCancelOrder} className="space-y-3">
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1.5">
                        Select or Write Cancellation Reason (Optional):
                      </label>
                      <div className="grid grid-cols-1 gap-1.5 mb-2">
                        {[
                          `${cancelAccInfo.labelEn} is invalid / not found`,
                          'Payment TrxID invalid or not received',
                          'Customer requested cancellation',
                          'Incorrect package selected by customer'
                        ].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setCancellationReason(preset)}
                            className={`text-left text-[11px] p-2 rounded-lg border transition ${
                              cancellationReason === preset
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                : 'bg-slate-950 text-slate-400 border-slate-800/80 hover:text-white hover:border-slate-700'
                            }`}
                          >
                            • {preset}
                          </button>
                        ))}
                      </div>

                      <textarea
                        rows={2}
                        placeholder="Custom reason to notify the customer on WhatsApp..."
                        value={cancellationReason}
                        onChange={(e) => setCancellationReason(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/50"
                      />
                    </div>

                    <p className="text-[11px] text-slate-400">
                      ⚠️ Cancelling will mark the order as <b className="text-rose-400">CANCELLED</b>, release any claimed worker in Telegram, and send a cancellation message to the customer on WhatsApp.
                    </p>

                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setCancellingOrder(null)}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={isCancelling}
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          );
        })()}
      </main>
    </div>
  );
}

