// docs/09 §2 + D-002/D-004 — derived membership facts. Pure: the caller supplies
// the rows, this decides what the UI shows.
import { daysUntil } from './time';
import type { DerivedMembershipStatus, MembershipStatus } from './state/membership';

export interface MembershipPeriod {
  id: string;
  status: MembershipStatus;
  startAt: Date;
  endAt: Date;
}

export function daysRemaining(endAt: Date, now: Date = new Date()): number {
  return daysUntil(endAt, now);
}

/** D-002 — EXPIRING is a view over ACTIVE, never a stored status. */
export function isExpiring(
  period: Pick<MembershipPeriod, 'status' | 'endAt'>,
  expiryWarningDays: number,
  now: Date = new Date(),
): boolean {
  if (period.status !== 'ACTIVE') return false;
  if (period.endAt.getTime() <= now.getTime()) return false;
  return daysUntil(period.endAt, now) <= expiryWarningDays;
}

/** What the Home screen renders. Adds EXPIRING on top of the stored status. */
export function derivedStatus(
  period: Pick<MembershipPeriod, 'status' | 'endAt'>,
  expiryWarningDays: number,
  now: Date = new Date(),
): DerivedMembershipStatus {
  if (period.status === 'ACTIVE' && period.endAt.getTime() <= now.getTime()) return 'EXPIRED';
  if (isExpiring(period, expiryWarningDays, now)) return 'EXPIRING';
  return period.status;
}

/** The current membership: the ACTIVE row with the greatest future `end_at`. */
export function currentPeriod<T extends Pick<MembershipPeriod, 'status' | 'endAt'>>(
  periods: readonly T[],
  now: Date = new Date(),
): T | null {
  let best: T | null = null;
  for (const period of periods) {
    if (period.status !== 'ACTIVE') continue;
    if (period.endAt.getTime() <= now.getTime()) continue;
    if (best === null || period.endAt.getTime() > best.endAt.getTime()) best = period;
  }
  return best;
}

/**
 * D-004 — a renewal stacks onto any currently valid period instead of
 * overwriting it. Mirrors `activate_membership_for_payment` so the client can
 * preview the dates the server will compute.
 */
export function computePeriod(
  existing: readonly Pick<MembershipPeriod, 'status' | 'endAt'>[],
  durationDays: number,
  now: Date = new Date(),
): { startAt: Date; endAt: Date } {
  if (!Number.isInteger(durationDays) || durationDays <= 0) {
    throw new RangeError(`durationDays must be a positive integer, received ${durationDays}`);
  }
  const current = currentPeriod(existing, now);
  const startAt = current ? current.endAt : now;
  const endAt = new Date(startAt.getTime() + durationDays * 86_400_000);
  return { startAt, endAt };
}
