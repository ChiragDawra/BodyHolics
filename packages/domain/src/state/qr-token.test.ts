import { describe, expect, it } from 'vitest';
import {
  QR_TOKEN_TTL_SECONDS,
  expiresAtFor,
  qrTokenState,
  redemptionError,
  secondsUntilRefresh,
} from './qr-token';

const now = new Date('2026-03-01T10:00:00Z');
const at = (offsetSeconds: number) => new Date(now.getTime() + offsetSeconds * 1000);

describe('member QR token (docs/09 §6)', () => {
  it('is VALID only while unused and unexpired', () => {
    expect(qrTokenState({ usedAt: null, expiresAt: at(60) }, now)).toBe('VALID');
  });

  it('is EXPIRED exactly at expiry, not a second later', () => {
    expect(qrTokenState({ usedAt: null, expiresAt: now }, now)).toBe('EXPIRED');
    expect(qrTokenState({ usedAt: null, expiresAt: at(-1) }, now)).toBe('EXPIRED');
  });

  it('is USED regardless of expiry — single use is terminal', () => {
    expect(qrTokenState({ usedAt: at(-10), expiresAt: at(60) }, now)).toBe('USED');
    expect(qrTokenState({ usedAt: at(-10), expiresAt: at(-1) }, now)).toBe('USED');
  });

  it('defaults `now` to the wall clock', () => {
    expect(qrTokenState({ usedAt: null, expiresAt: new Date(Date.now() + 60_000) })).toBe('VALID');
  });

  it('maps each state to the documented API error code', () => {
    expect(redemptionError('VALID')).toBeNull();
    expect(redemptionError('USED')).toBe('QR_TOKEN_ALREADY_USED');
    expect(redemptionError('EXPIRED')).toBe('QR_TOKEN_EXPIRED');
  });

  it('uses a 120s counter TTL and a 300s lookup TTL', () => {
    expect(QR_TOKEN_TTL_SECONDS.COUNTER_PAYMENT).toBe(120);
    expect(QR_TOKEN_TTL_SECONDS.MEMBER_LOOKUP).toBe(300);
    expect(expiresAtFor('COUNTER_PAYMENT', now).toISOString()).toBe('2026-03-01T10:02:00.000Z');
    expect(expiresAtFor('MEMBER_LOOKUP', now).toISOString()).toBe('2026-03-01T10:05:00.000Z');
  });

  it('defaults the issue time to the wall clock', () => {
    expect(expiresAtFor('COUNTER_PAYMENT').getTime()).toBeGreaterThan(Date.now());
  });

  it('refreshes at 100s so a stale QR is never displayed', () => {
    // A token issued at `now` expires at +120s and must refresh at +100s.
    expect(secondsUntilRefresh(at(120), now)).toBe(100);
    expect(secondsUntilRefresh(at(21), now)).toBe(1);
    expect(secondsUntilRefresh(at(20), now)).toBe(0);
    expect(secondsUntilRefresh(at(-5), now)).toBe(0);
  });

  it('defaults `now` when computing the refresh delay', () => {
    expect(secondsUntilRefresh(new Date(Date.now() + 120_000))).toBeGreaterThan(0);
  });
});
