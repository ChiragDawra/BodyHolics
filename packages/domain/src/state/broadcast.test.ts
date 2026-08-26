import { describe, expect, it } from 'vitest';
import { BROADCAST_STATUSES, canTransition, isBroadcastStatus } from './broadcast';

const now = new Date('2026-03-01T10:00:00Z');
const staff = { actor: 'STAFF', now } as const;
const system = { actor: 'SYSTEM', now } as const;
const future = new Date('2026-03-01T11:00:00Z');
const past = new Date('2026-03-01T09:00:00Z');

describe('broadcast state machine (docs/09 §5)', () => {
  it('schedules a draft only for a future publish time', () => {
    expect(canTransition('DRAFT', 'SCHEDULED', { ...staff, publishAt: future }).ok).toBe(true);
    const stale = canTransition('DRAFT', 'SCHEDULED', { ...staff, publishAt: past });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.error.code).toBe('VALIDATION_FAILED');
    expect(canTransition('DRAFT', 'SCHEDULED', staff).ok).toBe(false);
  });

  it('refuses scheduling exactly at now', () => {
    expect(canTransition('DRAFT', 'SCHEDULED', { ...staff, publishAt: now }).ok).toBe(false);
  });

  it('lets staff publish immediately, unschedule, and cancel', () => {
    expect(canTransition('DRAFT', 'PUBLISHED', staff).ok).toBe(true);
    expect(canTransition('SCHEDULED', 'DRAFT', staff).ok).toBe(true);
    expect(canTransition('SCHEDULED', 'CANCELLED', staff).ok).toBe(true);
  });

  it('reserves SCHEDULED -> PUBLISHED for the cron', () => {
    expect(canTransition('SCHEDULED', 'PUBLISHED', system).ok).toBe(true);
    const byStaff = canTransition('SCHEDULED', 'PUBLISHED', staff);
    expect(byStaff.ok).toBe(false);
    if (!byStaff.ok) expect(byStaff.error.code).toBe('FORBIDDEN');
  });

  it('refuses a SYSTEM actor on staff-only transitions', () => {
    expect(canTransition('DRAFT', 'PUBLISHED', system).ok).toBe(false);
    expect(canTransition('DRAFT', 'SCHEDULED', { ...system, publishAt: future }).ok).toBe(false);
  });

  it('makes PUBLISHED immutable and terminal', () => {
    for (const to of BROADCAST_STATUSES) {
      const result = canTransition('PUBLISHED', to, staff);
      expect(result.ok, `PUBLISHED -> ${to}`).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('BROADCAST_IMMUTABLE');
    }
  });

  it('makes CANCELLED terminal', () => {
    const result = canTransition('CANCELLED', 'DRAFT', staff);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('BROADCAST_IMMUTABLE');
    expect(canTransition('CANCELLED', 'CANCELLED', staff).ok).toBe(true);
  });

  it('rejects DRAFT -> CANCELLED, which is not in the table', () => {
    const result = canTransition('DRAFT', 'CANCELLED', staff);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_FAILED');
  });

  it('defaults `now` to the wall clock when omitted', () => {
    const soon = new Date(Date.now() + 60_000);
    expect(canTransition('DRAFT', 'SCHEDULED', { actor: 'STAFF', publishAt: soon }).ok).toBe(true);
  });

  it('narrows unknown values', () => {
    expect(isBroadcastStatus('DRAFT')).toBe(true);
    expect(isBroadcastStatus('SENT')).toBe(false);
    expect(isBroadcastStatus(0)).toBe(false);
  });
});
