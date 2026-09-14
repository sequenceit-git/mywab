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
  RefreshCw
} from 'lucide-react';
import { Order, OrderStatus } from '@/types';

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders);
        if (!selectedOrder && data.orders.length > 0) {
          setSelectedOrder(data.orders[0]);
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

  const handleUpdateStatus = async (orderIdCode: string, newStatus: OrderStatus) => {
    try {
      const res = await fetch(`/api/orders/${orderIdCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        fetchOrders();
        if (selectedOrder?.order_id === orderIdCode) {
          setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
        }
      }
    } catch (e) {
      console.error('Failed to update status:', e);
    }
  };

  const filteredOrders = orders.filter(o => {
    const matchesFilter = filterStatus === 'ALL' || o.status === filterStatus;
    const matchesSearch =
      o.order_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.delivery_phone.includes(searchQuery) ||
      (o.customer?.name && o.customer.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      o.delivery_address.address.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Order Management Center"
        subtitle="Live tracking of orders, worker claims, and customer dispatch"
      />

      <main className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-dark-900/90 border border-slate-800/80">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Order ID, Phone, Customer, Address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500/50"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {['ALL', 'PENDING_CLAIM', 'CLAIMED', 'PROCESSING', 'DELIVERED'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  filterStatus === status
                    ? 'bg-brand-500 text-dark-950 shadow-sm'
                    : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Master-Detail Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order List */}
          <div className="lg:col-span-2 space-y-3">
            {loading ? (
              <div className="py-16 text-center text-slate-500 text-xs">Loading orders...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-xs">No orders match the criteria.</div>
            ) : (
              filteredOrders.map((order) => {
                const isSelected = selectedOrder?.id === order.id;

                return (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 border-brand-500/50 shadow-lg shadow-brand-500/5 ring-1 ring-brand-500/30'
                        : 'bg-dark-900/90 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white">{order.order_id}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            order.status === 'PENDING_CLAIM'
                              ? 'status-badge-pending'
                              : order.status === 'DELIVERED'
                              ? 'status-badge-delivered'
                              : 'status-badge-claimed'
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>
                      <span className="text-sm font-extrabold text-brand-400">৳{order.total_amount}</span>
                    </div>

                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{order.customer?.name || order.delivery_address.name || 'Customer'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{order.delivery_phone}</span>
                      </div>
                      <div className="sm:col-span-2 flex items-center gap-1.5 text-[11px] text-slate-400 truncate">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{order.delivery_address.address}</span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Worker: <b className="text-slate-200">{order.current_worker?.full_name || 'Unassigned (Waiting in Telegram)'}</b></span>
                      <span>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Selected Order Detail Sidebar */}
          <div className="space-y-4">
            {selectedOrder ? (
              <div className="p-5 rounded-2xl bg-dark-900/90 border border-slate-800/80 space-y-4 sticky top-24">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Order Detail</span>
                    <h3 className="text-sm font-bold text-white font-mono">{selectedOrder.order_id}</h3>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                      selectedOrder.status === 'PENDING_CLAIM'
                        ? 'status-badge-pending'
                        : selectedOrder.status === 'DELIVERED'
                        ? 'status-badge-delivered'
                        : 'status-badge-claimed'
                    }`}
                  >
                    {selectedOrder.status}
                  </span>
                </div>

                {/* Items */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Ordered Items</h4>
                  <div className="space-y-1.5">
                    {selectedOrder.items?.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-950/60 border border-slate-800/50">
                        <div>
                          <div className="text-slate-200 font-semibold">{item.product_name}</div>
                          <div className="text-[10px] text-slate-400">Qty: {item.quantity} × ৳{item.unit_price}</div>
                        </div>
                        <div className="font-bold text-brand-400">৳{item.subtotal}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Customer & Delivery */}
                <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Delivery & Customer</h4>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/50 space-y-1.5 text-slate-300">
                    <div><b>Name:</b> {selectedOrder.customer?.name || selectedOrder.delivery_address.name || 'Anonymous'}</div>
                    <div><b>Phone:</b> {selectedOrder.delivery_phone}</div>
                    <div><b>Address:</b> {selectedOrder.delivery_address.address}</div>
                    {selectedOrder.customer_notes && (
                      <div className="text-amber-400 text-[11px]"><b>Notes:</b> {selectedOrder.customer_notes}</div>
                    )}
                  </div>
                </div>

                {/* Worker Assignment */}
                <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Telegram Dispatch</h4>
                  <div className="p-3 rounded-xl bg-telegram-500/10 border border-telegram-500/20 text-xs space-y-1">
                    <div className="text-telegram-500 font-semibold">
                      {selectedOrder.current_worker ? `Claimed by: ${selectedOrder.current_worker.full_name}` : 'Dispatched to Worker Group (Pending Claim)'}
                    </div>
                    {selectedOrder.current_worker?.telegram_username && (
                      <div className="text-[11px] text-slate-400 font-mono">@{selectedOrder.current_worker.telegram_username}</div>
                    )}
                  </div>
                </div>

                {/* Action Controls */}
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Update Status</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleUpdateStatus(selectedOrder.order_id, 'PROCESSING')}
                      className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
                    >
                      Processing
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedOrder.order_id, 'DELIVERED')}
                      className="py-2 px-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-xs font-bold text-dark-950 transition shadow-sm"
                    >
                      Mark Delivered
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 rounded-2xl bg-dark-900/50 border border-slate-800/60 text-center text-xs text-slate-500">
                Select an order from the list to view full details and actions.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
