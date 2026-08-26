// GENERATED MIRROR — do not edit.
//
// Source: packages/domain/src/state/payment.ts (D-012).
// Deno cannot import a pnpm workspace package, so this is a copy. Edit the
// source and run `pnpm test:shared-parity --write`; CI fails if the two drift.

// docs/09 §1 — Payment. The only place a payment transition is defined.
import { allow, deny, type Result, type TransitionError } from '../errors.ts';

export const PAYMENT_STATUSES = [
  'PENDING',
  'AUTHORIZED',
  'PAID',
  'FAILED',
  'CANCELLED',
  'REFUNDED',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

const ALLOWED: Record<PaymentStatus, readonly PaymentStatus[]> = {
  PENDING: ['AUTHORIZED', 'PAID', 'FAILED', 'CANCELLED'],
  AUTHORIZED: ['PAID', 'FAILED'],
  PAID: ['REFUNDED'],
  FAILED: [],
  CANCELLED: [],
  REFUNDED: [],
};

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === 'string' && (PAYMENT_STATUSES as readonly string[]).includes(value);
}

/**
 * A webhook replay is normal traffic, not an error: `from === to` is a no-op
 * that succeeds so the caller returns 200 without writing (docs/09 §1).
 */
export function canTransition(
  from: PaymentStatus,
  to: PaymentStatus,
): Result<void, TransitionError> {
  if (from === to) return allow();
  return ALLOWED[from].includes(to) ? allow() : deny('INVALID_PAYMENT_TRANSITION', from, to);
}

/** True when the transition is a replay that must not write again. */
export function isNoop(from: PaymentStatus, to: PaymentStatus): boolean {
  return from === to;
}

export function isTerminal(status: PaymentStatus): boolean {
  return ALLOWED[status].length === 0;
}
