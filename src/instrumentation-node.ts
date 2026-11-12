import { reconcilePendingPayments } from './lib/services/payment-reconciler';

// Fast fallback for missed/late ZiniPay webhooks (older orders back off inside the reconciler).
const RECONCILE_INTERVAL_MS = 20 * 1000;

// Run shortly after boot (recovers anything missed while the server was down), then periodically.
setTimeout(() => void reconcilePendingPayments(), 15 * 1000);
setInterval(() => void reconcilePendingPayments(), RECONCILE_INTERVAL_MS);
console.log('[PaymentReconciler] Scheduled every 20 seconds.');
