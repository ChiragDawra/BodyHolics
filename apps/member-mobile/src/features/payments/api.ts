import { invokeFunction, getFunction } from '@/lib/functions';

export type PaymentOrder = {
  paymentId: string;
  membershipId: string;
  amountPaise: number;
  currency: 'INR';
  method: 'ONLINE' | 'UPI_COUNTER' | 'CASH_COUNTER';
  razorpay?: { orderId: string; keyId: string; checkoutUrl: string };
};

/**
 * Starts a purchase. The request carries a plan id and a method — never an
 * amount. There is no amount field in the schema and adding one would be
 * rejected by `.strict()` before it reached the server's logic.
 *
 * The idempotency key is generated per attempt and reused on retry, so a member
 * double-tapping "Pay" gets one order rather than two.
 */
export function createPaymentOrder(input: {
  planId: string;
  method: 'ONLINE' | 'UPI_COUNTER' | 'CASH_COUNTER';
  idempotencyKey: string;
}) {
  const { idempotencyKey, ...body } = input;
  return invokeFunction<PaymentOrder>('create-payment-order', body, { idempotencyKey });
}

export type PaymentStatus = {
  paymentId: string;
  status: 'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  amountPaise: number;
  paidAt: string | null;
  failed: boolean;
  membership: { id: string; status: string; startAt: string | null; endAt: string | null } | null;
};

/** Polled while a payment settles. Reports; never decides. */
export function fetchPaymentStatus(paymentId: string) {
  return getFunction<PaymentStatus>('payment-status', { paymentId });
}

export type QrToken = { token: string; expiresAt: string; ttlSeconds: number };

/**
 * The token behind the counter QR. Short-lived by design, and the raw value
 * exists only in this response and on screen — it is never persisted or logged.
 */
export function createCounterToken(paymentId: string) {
  return invokeFunction<QrToken>('create-member-qr-token', {
    purpose: 'COUNTER_PAYMENT',
    paymentId,
  });
}
