import { describe, expect, it } from 'vitest';
import {
  daysUntil,
  formatInGym,
  formatLocalTimeLabel,
  gymDateKey,
  gymMinutesOfDay,
  gymWeekday,
  parseLocalTime,
} from './time';

// The gym timezone is data, not a constant — these are two different gyms.
const IST = 'Asia/Kolkata';
const NYC = 'America/New_York';

describe('gym-local time (CLAUDE.md rule 7)', () => {
  it('puts a 23:30 IST visit on that IST date, not the UTC one', () => {
    const instant = new Date('2026-03-01T18:00:00Z'); // 2026-03-01 23:30 IST
    expect(gymDateKey(instant, IST)).toBe('2026-03-01');
    expect(gymDateKey(instant, 'UTC')).toBe('2026-03-01');

    const late = new Date('2026-03-01T19:00:00Z'); // 2026-03-02 00:30 IST
    expect(gymDateKey(late, IST)).toBe('2026-03-02');
    expect(gymDateKey(late, 'UTC')).toBe('2026-03-01');
  });

  it('resolves the weekday in the gym timezone', () => {
    const instant = new Date('2026-03-01T19:00:00Z'); // Sunday UTC, Monday IST
    expect(gymWeekday(instant, 'UTC')).toBe(0);
    expect(gymWeekday(instant, IST)).toBe(1);
  });

  it('reports minutes since gym-local midnight', () => {
    expect(gymMinutesOfDay(new Date('2026-03-01T18:00:00Z'), IST)).toBe(23 * 60 + 30);
    expect(gymMinutesOfDay(new Date('2026-03-01T18:00:00Z'), 'UTC')).toBe(18 * 60);
  });

  it('handles a gym in a DST-observing zone', () => {
    // US DST began 2026-03-08; the same UTC instant is a different local hour.
    expect(gymMinutesOfDay(new Date('2026-03-07T18:00:00Z'), NYC)).toBe(13 * 60);
    expect(gymMinutesOfDay(new Date('2026-03-09T18:00:00Z'), NYC)).toBe(14 * 60);
  });

  it('parses HH:MM and HH:MM:SS', () => {
    expect(parseLocalTime('05:00')).toBe(300);
    expect(parseLocalTime('22:30:00')).toBe(1350);
    expect(parseLocalTime(' 00:00 ')).toBe(0);
  });

  it('rejects a malformed or out-of-range local time', () => {
    expect(() => parseLocalTime('5:00')).toThrow(RangeError);
    expect(() => parseLocalTime('24:00')).toThrow(RangeError);
    expect(() => parseLocalTime('12:60')).toThrow(RangeError);
    expect(() => parseLocalTime('closed')).toThrow(RangeError);
  });

  it('renders a 12-hour label for the Home banner', () => {
    expect(formatLocalTimeLabel('22:30')).toBe('10:30 PM');
    expect(formatLocalTimeLabel('05:00')).toBe('5:00 AM');
    expect(formatLocalTimeLabel('00:15')).toBe('12:15 AM');
    expect(formatLocalTimeLabel('12:00')).toBe('12:00 PM');
  });

  it('formats an instant in the gym timezone', () => {
    expect(formatInGym(new Date('2026-03-01T18:00:00Z'), IST, 'dd MMM yyyy HH:mm')).toBe(
      '01 Mar 2026 23:30',
    );
  });

  it('rounds days remaining up and floors at zero', () => {
    const now = new Date('2026-03-01T00:00:00Z');
    expect(daysUntil(new Date('2026-03-02T00:00:00Z'), now)).toBe(1);
    expect(daysUntil(new Date('2026-03-01T00:00:01Z'), now)).toBe(1);
    expect(daysUntil(new Date('2026-03-01T00:00:00Z'), now)).toBe(0);
    expect(daysUntil(new Date('2026-02-01T00:00:00Z'), now)).toBe(0);
  });

  it('defaults `now` to the wall clock', () => {
    expect(daysUntil(new Date(Date.now() + 86_400_000))).toBe(1);
  });
});
