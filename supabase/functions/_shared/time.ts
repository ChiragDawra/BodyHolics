// GENERATED MIRROR — do not edit.
//
// Source: packages/domain/src/time.ts (D-012).
// Deno cannot import a pnpm workspace package, so this is a copy. Edit the
// source and run `pnpm test:shared-parity --write`; CI fails if the two drift.

// CLAUDE.md rule 7 — all logic is UTC; the gym timezone is a parameter, never
// a hardcoded constant. `Asia/Kolkata` must not appear in this file.
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

/** IANA timezone id, e.g. the value stored in `gyms.timezone`. */
export type Timezone = string;

/** 0 = Sunday .. 6 = Saturday, matching Postgres `extract(dow)`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** `HH:MM` or `HH:MM:SS` as stored in `gym_hours.opens_at`/`closes_at`. */
export type LocalTime = string;

/** The gym-local weekday of an instant. */
export function gymWeekday(instant: Date, timezone: Timezone): Weekday {
  return toZonedTime(instant, timezone).getDay() as Weekday;
}

/** The gym-local calendar date of an instant, as `YYYY-MM-DD`. */
export function gymDateKey(instant: Date, timezone: Timezone): string {
  return formatInTimeZone(instant, timezone, 'yyyy-MM-dd');
}

/** Minutes since gym-local midnight. A 23:30 IST visit belongs to that IST day. */
export function gymMinutesOfDay(instant: Date, timezone: Timezone): number {
  const local = toZonedTime(instant, timezone);
  return local.getHours() * 60 + local.getMinutes();
}

/** Parses `HH:MM[:SS]` into minutes since midnight. */
export function parseLocalTime(value: LocalTime): number {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) throw new RangeError(`Not a local time: ${value}`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new RangeError(`Not a local time: ${value}`);
  return hours * 60 + minutes;
}

/** Formats an instant for display in the gym's timezone. */
export function formatInGym(instant: Date, timezone: Timezone, pattern: string): string {
  return formatInTimeZone(instant, timezone, pattern);
}

/** `"10:30 PM"` — used by the Home status banner. */
export function formatLocalTimeLabel(value: LocalTime): string {
  const minutes = parseLocalTime(value);
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(mins).padStart(2, '0')} ${suffix}`;
}

/** Whole days between two instants, rounded up, floored at zero. */
export function daysUntil(target: Date, now: Date = new Date()): number {
  const seconds = (target.getTime() - now.getTime()) / 1000;
  if (seconds <= 0) return 0;
  return Math.ceil(seconds / 86_400);
}
