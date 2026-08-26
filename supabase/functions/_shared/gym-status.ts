// GENERATED MIRROR — do not edit.
//
// Source: packages/domain/src/gym-status.ts (D-012).
// Deno cannot import a pnpm workspace package, so this is a copy. Edit the
// source and run `pnpm test:shared-parity --write`; CI fails if the two drift.

// docs/09 §3 — gym status is computed, never stored on `gyms`.
// Resolution order: active override, then the weekly schedule, then CLOSED.
import { gymMinutesOfDay, gymWeekday, parseLocalTime } from './time.ts';
import type { LocalTime, Timezone, Weekday } from './time.ts';

export const GYM_STATUSES = ['OPEN', 'CLOSED'] as const;
export type GymStatus = (typeof GYM_STATUSES)[number];

export type GymStatusSource = 'MANUAL_OVERRIDE' | 'SCHEDULE';

export interface GymHoursRow {
  weekday: Weekday;
  isClosed: boolean;
  opensAt: LocalTime | null;
  closesAt: LocalTime | null;
}

export interface GymStatusOverrideRow {
  forcedStatus: GymStatus;
  startsAt: Date;
  endsAt: Date;
  reason: string | null;
}

export interface ResolvedGymStatus {
  status: GymStatus;
  source: GymStatusSource;
  reason: string | null;
  /** Gym-local `HH:MM` the current state ends at, when the schedule knows it. */
  until: LocalTime | null;
}

/**
 * @param hours the seven `gym_hours` rows for the gym
 * @param overrides candidate `gym_status_overrides` rows; expired ones are ignored
 */
export function resolveGymStatus(
  hours: readonly GymHoursRow[],
  overrides: readonly GymStatusOverrideRow[],
  timezone: Timezone,
  now: Date = new Date(),
): ResolvedGymStatus {
  const active = activeOverride(overrides, now);
  if (active) {
    return {
      status: active.forcedStatus,
      source: 'MANUAL_OVERRIDE',
      reason: active.reason,
      until: null,
    };
  }

  const weekday = gymWeekday(now, timezone);
  const today = hours.find((row) => row.weekday === weekday);
  if (!today || today.isClosed || today.opensAt === null || today.closesAt === null) {
    return { status: 'CLOSED', source: 'SCHEDULE', reason: null, until: null };
  }

  const minutes = gymMinutesOfDay(now, timezone);
  const opens = parseLocalTime(today.opensAt);
  const closes = parseLocalTime(today.closesAt);

  // Q5: same-day windows only. A row where closes <= opens is invalid data
  // rather than an overnight window, and resolves CLOSED instead of wrapping.
  if (closes <= opens) {
    return { status: 'CLOSED', source: 'SCHEDULE', reason: null, until: null };
  }

  const isOpen = minutes >= opens && minutes < closes;
  return {
    status: isOpen ? 'OPEN' : 'CLOSED',
    source: 'SCHEDULE',
    reason: null,
    until: isOpen ? today.closesAt : minutes < opens ? today.opensAt : null,
  };
}

/** The override in force right now, if any. Later `startsAt` wins a tie. */
export function activeOverride(
  overrides: readonly GymStatusOverrideRow[],
  now: Date = new Date(),
): GymStatusOverrideRow | null {
  let best: GymStatusOverrideRow | null = null;
  for (const override of overrides) {
    if (override.startsAt.getTime() > now.getTime()) continue;
    if (override.endsAt.getTime() <= now.getTime()) continue;
    if (best === null || override.startsAt.getTime() > best.startsAt.getTime()) best = override;
  }
  return best;
}

/** An override window must be non-empty (`OVERRIDE_RANGE_INVALID`). */
export function isValidOverrideRange(startsAt: Date, endsAt: Date): boolean {
  return endsAt.getTime() > startsAt.getTime();
}
