import { Order } from '@/types';

export function hydrateOrder(data: any): Order {
  if (!data) return data;

  // Extract player_uid with multi-layer fallback
  let playerUid = data.player_uid;
  if (!playerUid && data.delivery_address && typeof data.delivery_address === 'object') {
    playerUid = data.delivery_address.player_uid || data.delivery_address.name;
    if (!playerUid && typeof data.delivery_address.address === 'string') {
      const match = data.delivery_address.address.match(/(?:UID|Player UID|Email|Gmail|Account|ID|Phone):\s*([0-9a-zA-Z@._+-]+)/i);
      if (match) playerUid = match[1];
    }
  }
  if (!playerUid && typeof data.customer_notes === 'string') {
    const match = data.customer_notes.match(/(?:PUBG UID|Free Fire UID|UID|Player UID|Email|Gmail|Account|ID):\s*([0-9a-zA-Z@._+-]+)/i);
    if (match) playerUid = match[1];
  }

  // Extract trx_id with multi-layer fallback
  let trxId = data.trx_id;
  if (!trxId && data.delivery_address && typeof data.delivery_address === 'object') {
    trxId = data.delivery_address.trx_id || data.delivery_address.notes;
  }
  if (!trxId && typeof data.customer_notes === 'string') {
    const match = data.customer_notes.match(/Trx:\s*([^|\n]+)/i);
    if (match) trxId = match[1].trim();
  }
  if (!trxId && Array.isArray(data.payments) && data.payments.length > 0) {
    trxId = data.payments[0].transaction_id || data.payments[0].trx_id;
  }

  // Extract payment_method with multi-layer fallback
  let paymentMethod = data.payment_method;
  if (!paymentMethod && data.delivery_address && typeof data.delivery_address === 'object') {
    paymentMethod = data.delivery_address.payment_method;
  }
  if (!paymentMethod && typeof data.customer_notes === 'string') {
    const match = data.customer_notes.match(/Pay:\s*([^|\n]+)/i);
    if (match) paymentMethod = match[1].trim();
  }
  if (!paymentMethod && Array.isArray(data.payments) && data.payments.length > 0) {
    paymentMethod = data.payments[0].payment_method || data.payments[0].method;
  }

  // Extract invoice_id and payment_url for ZiniPay integration
  let invoiceId = data.invoice_id;
  if (!invoiceId && data.delivery_address && typeof data.delivery_address === 'object') {
    invoiceId = data.delivery_address.invoice_id;
  }
  if (!invoiceId && Array.isArray(data.payments) && data.payments.length > 0) {
    invoiceId = data.payments[0].invoice_id;
  }

  let paymentUrl = data.payment_url;
  if (!paymentUrl && data.delivery_address && typeof data.delivery_address === 'object') {
    paymentUrl = data.delivery_address.payment_url;
  }

  const assignments = Array.isArray(data.assignments) ? data.assignments : [];
  const assignedWorker = 
    data.current_worker || 
    assignments.find((a: any) => ['CLAIMED', 'PROCESSING', 'OUT_FOR_DELIVERY', 'IN_PROGRESS', 'DELIVERED'].includes(a.status))?.worker ||
    assignments[0]?.worker ||
    null;

  return {
    ...data,
    player_uid: playerUid || undefined,
    trx_id: trxId || undefined,
    payment_method: paymentMethod || 'bKash/Nagad/Rocket',
    invoice_id: invoiceId || undefined,
    payment_url: paymentUrl || undefined,
    current_worker: assignedWorker
  };
}
