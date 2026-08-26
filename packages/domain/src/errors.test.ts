import { describe, expect, it } from 'vitest';
import {
  AppError,
  ERROR_CODES,
  ERROR_MESSAGES,
  allow,
  deny,
  isErrorCode,
  messageFor,
} from './errors';

describe('error registry (docs/07 §2)', () => {
  it('has a message for every declared code', () => {
    for (const code of ERROR_CODES) {
      expect(ERROR_MESSAGES[code], code).toBeTruthy();
    }
    expect(Object.keys(ERROR_MESSAGES).sort()).toEqual([...ERROR_CODES].sort());
  });

  it('never leaks internals to a user', () => {
    // docs/06 §8 — no SQL, no stack traces, no UUIDs, no provider payloads.
    for (const message of Object.values(ERROR_MESSAGES)) {
      expect(message).not.toMatch(/select |insert |update |postgres|supabase|razorpay/i);
      expect(message).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
    }
  });

  it('gives an authorization failure the same wording regardless of cause', () => {
    // Distinguishing "not staff" from "wrong gym" would confirm a row exists.
    const opaque = ERROR_MESSAGES.FORBIDDEN;
    expect(ERROR_MESSAGES.NOT_GYM_STAFF).toBe(opaque);
    expect(ERROR_MESSAGES.NOT_GYM_MEMBER).toBe(opaque);
    expect(ERROR_MESSAGES.CROSS_TENANT_ACCESS).toBe(opaque);
  });

  it('falls back to INTERNAL_ERROR for an unknown code', () => {
    expect(messageFor('PAYMENT_NOT_FOUND')).toBe(ERROR_MESSAGES.PAYMENT_NOT_FOUND);
    expect(messageFor('SOMETHING_NEW')).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
  });

  it('narrows unknown values', () => {
    expect(isErrorCode('RATE_LIMITED')).toBe(true);
    expect(isErrorCode('NOPE')).toBe(false);
    expect(isErrorCode(42)).toBe(false);
  });

  it('carries a request id on AppError for support to quote', () => {
    const withId = new AppError('QR_TOKEN_EXPIRED', 'req_123');
    expect(withId.code).toBe('QR_TOKEN_EXPIRED');
    expect(withId.message).toBe(ERROR_MESSAGES.QR_TOKEN_EXPIRED);
    expect(withId.requestId).toBe('req_123');
    expect(withId).toBeInstanceOf(Error);
    expect(new AppError('INTERNAL_ERROR').requestId).toBeUndefined();
  });

  it('builds allow/deny results', () => {
    expect(allow()).toEqual({ ok: true, value: undefined });
    expect(deny('RATE_LIMITED', 'A', 'B')).toEqual({
      ok: false,
      error: { code: 'RATE_LIMITED', from: 'A', to: 'B' },
    });
  });
});
