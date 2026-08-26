import { describe, expect, it } from 'vitest';
import {
  computePeriod,
  currentPeriod,
  daysRemaining,
  derivedStatus,
  isExpiring,
} from './membership';

const now = new Date('2026-03-01T00:00:00Z');
const days = (n: number) => new Date(now.getTime() + n * 86_400_000);

describe('membership derivations (D-002, D-004)', () => {
  it('counts whole days remaining, floored at zero', () => {
    expect(daysRemaining(days(10), now)).toBe(10);
    expect(daysRemaining(days(-1), now)).toBe(0);
    expect(daysRemaining(new Date(Date.now() + 86_400_000))).toBe(1);
  });

  it('flags EXPIRING only inside the warning window', () => {
    const period = { status: 'ACTIVE' as const, endAt: days(5) };
    expect(isExpiring(period, 7, now)).toBe(true);
    expect(isExpiring(period, 3, now)).toBe(false);
    expect(isExpiring({ status: 'ACTIVE', endAt: days(7) }, 7, now)).toBe(true);
  });

  it('never flags a non-ACTIVE or already-past membership as EXPIRING', () => {
    expect(isExpiring({ status: 'PENDING_PAYMENT', endAt: days(1) }, 7, now)).toBe(false);
    expect(isExpiring({ status: 'EXPIRED', endAt: days(1) }, 7, now)).toBe(false);
    expect(isExpiring({ status: 'ACTIVE', endAt: days(-1) }, 7, now)).toBe(false);
    expect(isExpiring({ status: 'ACTIVE', endAt: now }, 7, now)).toBe(false);
  });

  it('shows EXPIRED rather than "0 days left" once end_at has passed', () => {
    expect(derivedStatus({ status: 'ACTIVE', endAt: days(-1) }, 7, now)).toBe('EXPIRED');
    expect(derivedStatus({ status: 'ACTIVE', endAt: days(3) }, 7, now)).toBe('EXPIRING');
    expect(derivedStatus({ status: 'ACTIVE', endAt: days(30) }, 7, now)).toBe('ACTIVE');
    expect(derivedStatus({ status: 'PENDING_PAYMENT', endAt: days(30) }, 7, now)).toBe(
      'PENDING_PAYMENT',
    );
    expect(derivedStatus({ status: 'CANCELLED', endAt: days(30) }, 7, now)).toBe('CANCELLED');
  });

  it('defaults `now` to the wall clock', () => {
    expect(
      derivedStatus({ status: 'ACTIVE', endAt: new Date(Date.now() + 86_400_000 * 90) }, 7),
    ).toBe('ACTIVE');
    expect(isExpiring({ status: 'ACTIVE', endAt: new Date(Date.now() + 86_400_000) }, 7)).toBe(true);
  });

  it('picks the ACTIVE row with the greatest future end_at as current', () => {
    const rows = [
      { id: 'a', status: 'ACTIVE' as const, endAt: days(10) },
      { id: 'b', status: 'ACTIVE' as const, endAt: days(40) },
      { id: 'c', status: 'EXPIRED' as const, endAt: days(60) },
      { id: 'd', status: 'ACTIVE' as const, endAt: days(-2) },
    ];
    expect(currentPeriod(rows, now)?.id).toBe('b');
    // A shorter ACTIVE period appearing after the longest one must not win.
    expect(
      currentPeriod(
        [
          { id: 'long', status: 'ACTIVE' as const, endAt: days(40) },
          { id: 'short', status: 'ACTIVE' as const, endAt: days(5) },
        ],
        now,
      )?.id,
    ).toBe('long');
    expect(currentPeriod([], now)).toBeNull();
    expect(currentPeriod([{ id: 'd', status: 'ACTIVE', endAt: days(-2) }], now)).toBeNull();
    expect(
      currentPeriod([{ id: 'a', status: 'ACTIVE', endAt: new Date(Date.now() + 86_400_000) }])?.id,
    ).toBe('a');
  });

  it('stacks a renewal onto the end of the current period (D-004)', () => {
    const existing = [{ status: 'ACTIVE' as const, endAt: days(10) }];
    const period = computePeriod(existing, 30, now);
    expect(period.startAt).toEqual(days(10));
    expect(period.endAt).toEqual(days(40));
  });

  it('starts a first or lapsed membership at now, not at a stale end_at', () => {
    expect(computePeriod([], 30, now).startAt).toEqual(now);
    expect(computePeriod([{ status: 'EXPIRED', endAt: days(-5) }], 30, now).startAt).toEqual(now);
    expect(computePeriod([], 30).startAt.getTime()).toBeGreaterThan(Date.now() - 1000);
  });

  it('refuses a nonsensical plan duration', () => {
    expect(() => computePeriod([], 0, now)).toThrow(RangeError);
    expect(() => computePeriod([], -30, now)).toThrow(RangeError);
    expect(() => computePeriod([], 30.5, now)).toThrow(RangeError);
  });
});
