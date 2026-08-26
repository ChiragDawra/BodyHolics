import { describe, expect, it } from 'vitest';
import { PAYMENT_STATUSES, canTransition, isNoop, isPaymentStatus, isTerminal } from './payment';
import type { PaymentStatus } from './payment';

const ALLOWED: ReadonlyArray<[PaymentStatus, PaymentStatus]> = [
  ['PENDING', 'AUTHORIZED'],
  ['PENDING', 'PAID'], // counter payment, or webhook payment.captured
  ['PENDING', 'FAILED'],
  ['PENDING', 'CANCELLED'],
  ['AUTHORIZED', 'PAID'],
  ['AUTHORIZED', 'FAILED'],
  ['PAID', 'REFUNDED'],
];

describe('payment state machine (docs/09 §1)', () => {
  it.each(ALLOWED)('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to).ok).toBe(true);
  });

  it('rejects every transition not in the table', () => {
    const allowed = new Set(ALLOWED.map(([from, to]) => `${from}>${to}`));
    for (const from of PAYMENT_STATUSES) {
      for (const to of PAYMENT_STATUSES) {
        if (from === to || allowed.has(`${from}>${to}`)) continue;
        const result = canTransition(from, to);
        expect(result.ok, `${from} -> ${to} should be rejected`).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('INVALID_PAYMENT_TRANSITION');
      }
    }
  });

  it('treats a webhook replay as a successful no-op, not an error', () => {
    for (const status of PAYMENT_STATUSES) {
      expect(canTransition(status, status).ok).toBe(true);
      expect(isNoop(status, status)).toBe(true);
    }
    expect(isNoop('PENDING', 'PAID')).toBe(false);
  });

  it('never allows a path back out of a terminal status', () => {
    expect(isTerminal('FAILED')).toBe(true);
    expect(isTerminal('CANCELLED')).toBe(true);
    expect(isTerminal('REFUNDED')).toBe(true);
    expect(isTerminal('PAID')).toBe(false); // PAID -> REFUNDED remains open
    expect(isTerminal('PENDING')).toBe(false);
  });

  it('reports the offending pair on rejection', () => {
    const result = canTransition('FAILED', 'PAID');
    expect(result).toEqual({
      ok: false,
      error: { code: 'INVALID_PAYMENT_TRANSITION', from: 'FAILED', to: 'PAID' },
    });
  });

  it('narrows unknown values', () => {
    expect(isPaymentStatus('PAID')).toBe(true);
    expect(isPaymentStatus('SETTLED')).toBe(false);
    expect(isPaymentStatus(7)).toBe(false);
  });
});
