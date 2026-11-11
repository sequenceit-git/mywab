import { reconcilePendingPayments } from './lib/services/payment-reconciler';

const RECONCILE_INTERVAL_MS = 2 * 60 * 1000;

// Run shortly after boot (recovers anything missed while the server was down), then periodically.
setTimeout(() => void reconcilePendingPayments(), 15 * 1000);
setInterval(() => void reconcilePendingPayments(), RECONCILE_INTERVAL_MS);
console.log('[PaymentReconciler] Scheduled every 2 minutes.');
