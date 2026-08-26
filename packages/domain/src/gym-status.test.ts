import { describe, expect, it } from 'vitest';
import { activeOverride, isValidOverrideRange, resolveGymStatus } from './gym-status';
import type { GymHoursRow, GymStatusOverrideRow } from './gym-status';

const IST = 'Asia/Kolkata';

/** Open 05:00–22:30 every day except Sunday (weekday 0). */
const WEEK: GymHoursRow[] = [
  { weekday: 0, isClosed: true, opensAt: null, closesAt: null },
  ...([1, 2, 3, 4, 5, 6] as const).map((weekday) => ({
    weekday,
    isClosed: false,
    opensAt: '05:00',
    closesAt: '22:30',
  })),
];

// 2026-03-02 is a Monday.
const at = (iso: string) => new Date(iso);

describe('gym status resolution (docs/09 §3)', () => {
  it('is OPEN inside the local window', () => {
    // 06:00 IST Monday
    expect(resolveGymStatus(WEEK, [], IST, at('2026-03-02T00:30:00Z'))).toEqual({
      status: 'OPEN',
      source: 'SCHEDULE',
      reason: null,
      until: '22:30',
    });
  });

  it('is CLOSED before opening and reports when it opens', () => {
    // 04:00 IST Monday
    expect(resolveGymStatus(WEEK, [], IST, at('2026-03-01T22:30:00Z'))).toEqual({
      status: 'CLOSED',
      source: 'SCHEDULE',
      reason: null,
      until: '05:00',
    });
  });

  it('is CLOSED after closing, with nothing further to report today', () => {
    // 23:00 IST Monday
    expect(resolveGymStatus(WEEK, [], IST, at('2026-03-02T17:30:00Z'))).toEqual({
      status: 'CLOSED',
      source: 'SCHEDULE',
      reason: null,
      until: null,
    });
  });

  it('treats the closing minute as closed, and the opening minute as open', () => {
    expect(resolveGymStatus(WEEK, [], IST, at('2026-03-02T17:00:00Z')).status).toBe('CLOSED'); // 22:30
    expect(resolveGymStatus(WEEK, [], IST, at('2026-03-01T23:30:00Z')).status).toBe('OPEN'); // 05:00
  });

  it('resolves against the gym timezone, not the server one', () => {
    // 2026-03-01T23:00Z is Sunday in UTC but Monday 04:30 in IST.
    expect(resolveGymStatus(WEEK, [], 'UTC', at('2026-03-01T23:00:00Z')).status).toBe('CLOSED');
    expect(resolveGymStatus(WEEK, [], IST, at('2026-03-01T23:00:00Z')).until).toBe('05:00');
  });

  it('is CLOSED on a day flagged closed', () => {
    // Sunday 10:00 IST
    expect(resolveGymStatus(WEEK, [], IST, at('2026-03-01T04:30:00Z')).status).toBe('CLOSED');
  });

  it('is CLOSED when the weekday has no row at all', () => {
    const partial = WEEK.filter((row) => row.weekday !== 1);
    expect(resolveGymStatus(partial, [], IST, at('2026-03-02T00:30:00Z')).status).toBe('CLOSED');
  });

  it('is CLOSED when a row is open but has null times', () => {
    const broken: GymHoursRow[] = [{ weekday: 1, isClosed: false, opensAt: null, closesAt: '22:30' }];
    expect(resolveGymStatus(broken, [], IST, at('2026-03-02T00:30:00Z')).status).toBe('CLOSED');
    const broken2: GymHoursRow[] = [{ weekday: 1, isClosed: false, opensAt: '05:00', closesAt: null }];
    expect(resolveGymStatus(broken2, [], IST, at('2026-03-02T00:30:00Z')).status).toBe('CLOSED');
  });

  it('refuses to silently wrap an overnight window (Q5)', () => {
    // 22:00 -> 06:00 is invalid data, not a 24h gym. Resolve CLOSED, do not wrap.
    const overnight: GymHoursRow[] = [
      { weekday: 1, isClosed: false, opensAt: '22:00', closesAt: '06:00' },
    ];
    expect(resolveGymStatus(overnight, [], IST, at('2026-03-02T17:00:00Z')).status).toBe('CLOSED');
    const zeroLength: GymHoursRow[] = [
      { weekday: 1, isClosed: false, opensAt: '05:00', closesAt: '05:00' },
    ];
    expect(resolveGymStatus(zeroLength, [], IST, at('2026-03-02T00:30:00Z')).status).toBe('CLOSED');
  });

  it('lets an active override beat the schedule in both directions', () => {
    const closedOverride: GymStatusOverrideRow = {
      forcedStatus: 'CLOSED',
      startsAt: at('2026-03-02T00:00:00Z'),
      endsAt: at('2026-03-02T06:00:00Z'),
      reason: 'Water supply cut',
    };
    // Would be OPEN on the schedule.
    expect(resolveGymStatus(WEEK, [closedOverride], IST, at('2026-03-02T00:30:00Z'))).toEqual({
      status: 'CLOSED',
      source: 'MANUAL_OVERRIDE',
      reason: 'Water supply cut',
      until: null,
    });

    const openOverride: GymStatusOverrideRow = {
      forcedStatus: 'OPEN',
      startsAt: at('2026-03-01T04:00:00Z'),
      endsAt: at('2026-03-01T06:00:00Z'),
      reason: null,
    };
    // Would be CLOSED on the schedule (Sunday).
    expect(resolveGymStatus(WEEK, [openOverride], IST, at('2026-03-01T04:30:00Z')).status).toBe(
      'OPEN',
    );
  });

  it('ignores an override that has not started or has already ended', () => {
    const future: GymStatusOverrideRow = {
      forcedStatus: 'CLOSED',
      startsAt: at('2026-03-03T00:00:00Z'),
      endsAt: at('2026-03-03T06:00:00Z'),
      reason: null,
    };
    const past: GymStatusOverrideRow = {
      forcedStatus: 'CLOSED',
      startsAt: at('2026-02-01T00:00:00Z'),
      endsAt: at('2026-02-01T06:00:00Z'),
      reason: null,
    };
    expect(resolveGymStatus(WEEK, [future, past], IST, at('2026-03-02T00:30:00Z')).source).toBe(
      'SCHEDULE',
    );
  });

  it('expires an override exactly at ends_at — there is no "clear" write', () => {
    const override: GymStatusOverrideRow = {
      forcedStatus: 'CLOSED',
      startsAt: at('2026-03-02T00:00:00Z'),
      endsAt: at('2026-03-02T01:00:00Z'),
      reason: null,
    };
    expect(resolveGymStatus(WEEK, [override], IST, at('2026-03-02T00:59:59Z')).source).toBe(
      'MANUAL_OVERRIDE',
    );
    expect(resolveGymStatus(WEEK, [override], IST, at('2026-03-02T01:00:00Z')).source).toBe(
      'SCHEDULE',
    );
  });

  it('picks the most recently started override when two overlap', () => {
    const older: GymStatusOverrideRow = {
      forcedStatus: 'CLOSED',
      startsAt: at('2026-03-02T00:00:00Z'),
      endsAt: at('2026-03-02T12:00:00Z'),
      reason: 'older',
    };
    const newer: GymStatusOverrideRow = {
      forcedStatus: 'OPEN',
      startsAt: at('2026-03-02T00:10:00Z'),
      endsAt: at('2026-03-02T12:00:00Z'),
      reason: 'newer',
    };
    expect(activeOverride([older, newer], at('2026-03-02T00:30:00Z'))?.reason).toBe('newer');
    expect(activeOverride([newer, older], at('2026-03-02T00:30:00Z'))?.reason).toBe('newer');
    expect(activeOverride([], at('2026-03-02T00:30:00Z'))).toBeNull();
  });

  it('defaults `now` to the wall clock', () => {
    expect(activeOverride([])).toBeNull();
    expect(resolveGymStatus(WEEK, [], IST).source).toBe('SCHEDULE');
  });

  it('rejects an empty or inverted override window', () => {
    expect(isValidOverrideRange(at('2026-03-02T00:00:00Z'), at('2026-03-02T01:00:00Z'))).toBe(true);
    expect(isValidOverrideRange(at('2026-03-02T01:00:00Z'), at('2026-03-02T01:00:00Z'))).toBe(false);
    expect(isValidOverrideRange(at('2026-03-02T02:00:00Z'), at('2026-03-02T01:00:00Z'))).toBe(false);
  });
});
