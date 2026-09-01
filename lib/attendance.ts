import { GYM_TIME_ZONE } from "@/lib/gym";

/**
 * Everything derived from the attendance log: streaks, month grids, and the
 * week strip on the home screen.
 *
 * All of it is computed from `checked_in_at` alone — the design doc is
 * explicit that none of this needs a migration.
 *
 * Every date here is a YYYY-MM-DD string in the gym's timezone, never a Date,
 * because "which day was that visit on" is a question about Asia/Kolkata and
 * not about the phone's clock.
 */

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: GYM_TIME_ZONE,
});

/** A timestamptz -> the gym-local calendar day it fell on. */
export function gymDayOf(iso: string): string {
  return dayFormatter.format(new Date(iso));
}

export function gymTodayKey(now: Date = new Date()): string {
  return dayFormatter.format(now);
}

/** Distinct days visited, newest first. */
export function visitedDays(checkIns: readonly { checked_in_at: string }[]): Set<string> {
  return new Set(checkIns.map((c) => gymDayOf(c.checked_in_at)));
}

function shiftDay(key: string, delta: number): string {
  // Parsed at noon UTC so a ±1 day shift can never cross a DST or offset edge.
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export type Streak = {
  /** Consecutive days ending today, or yesterday if today has no visit yet. */
  current: number;
  longest: number;
  /** True when the run ended before yesterday, so the streak is over. */
  broken: boolean;
};

/**
 * A streak counts consecutive calendar days with at least one check-in.
 *
 * Today not having a visit *yet* does not break the streak — it is still early.
 * The run is only broken once a whole day has passed with nothing in it.
 */
export function computeStreak(
  days: Set<string>,
  now: Date = new Date(),
): Streak {
  if (days.size === 0) return { current: 0, longest: 0, broken: false };

  const today = gymTodayKey(now);
  const yesterday = shiftDay(today, -1);

  let anchor: string | null = null;
  if (days.has(today)) anchor = today;
  else if (days.has(yesterday)) anchor = yesterday;

  let current = 0;
  if (anchor) {
    let cursor = anchor;
    while (days.has(cursor)) {
      current += 1;
      cursor = shiftDay(cursor, -1);
    }
  }

  // Longest run anywhere in the history.
  const sorted = [...days].sort();
  let longest = 0;
  let run = 0;
  let previous: string | null = null;

  for (const day of sorted) {
    run = previous !== null && shiftDay(previous, 1) === day ? run + 1 : 1;
    if (run > longest) longest = run;
    previous = day;
  }

  return { current, longest, broken: current === 0 };
}

export type WeekDot = {
  key: string;
  label: string;
  visited: boolean;
  isToday: boolean;
};

/** The last seven days, oldest first, for the strip on the streak card. */
export function weekStrip(days: Set<string>, now: Date = new Date()): WeekDot[] {
  const today = gymTodayKey(now);
  const initials = ["S", "M", "T", "W", "T", "F", "S"];

  return Array.from({ length: 7 }, (_, i) => {
    const key = shiftDay(today, i - 6);
    const weekday = new Date(`${key}T12:00:00Z`).getUTCDay();
    return {
      key,
      label: initials[weekday] ?? "",
      visited: days.has(key),
      isToday: key === today,
    };
  });
}

export type MonthGrid = {
  /** First day of the month, YYYY-MM-01. */
  monthKey: string;
  visits: number;
  visitedDayCount: number;
  daysInMonth: number;
  /**
   * Cells for a Monday-first grid. Leading nulls pad the first row so the
   * first of the month lands under the right weekday.
   */
  cells: Array<{ key: string; visited: boolean; isToday: boolean } | null>;
};

/**
 * Groups check-ins into month grids, newest month first — the
 * contribution-graph view on the Activity tab.
 */
export function monthGrids(
  checkIns: readonly { checked_in_at: string }[],
  now: Date = new Date(),
): MonthGrid[] {
  if (checkIns.length === 0) return [];

  const today = gymTodayKey(now);
  const perDay = new Map<string, number>();
  for (const c of checkIns) {
    const day = gymDayOf(c.checked_in_at);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }

  const months = new Map<string, MonthGrid>();

  for (const day of [...perDay.keys()].sort().reverse()) {
    const monthKey = `${day.slice(0, 7)}-01`;
    if (months.has(monthKey)) continue;

    const year = Number(monthKey.slice(0, 4));
    const month = Number(monthKey.slice(5, 7));
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    // getUTCDay is Sunday-first; the grid is Monday-first.
    const firstWeekday = new Date(`${monthKey}T12:00:00Z`).getUTCDay();
    const pad = (firstWeekday + 6) % 7;

    const cells: MonthGrid["cells"] = Array.from({ length: pad }, () => null);
    let visits = 0;
    let visitedDayCount = 0;

    for (let d = 1; d <= daysInMonth; d += 1) {
      const key = `${monthKey.slice(0, 8)}${String(d).padStart(2, "0")}`;
      const count = perDay.get(key) ?? 0;
      if (count > 0) {
        visits += count;
        visitedDayCount += 1;
      }
      cells.push({ key, visited: count > 0, isToday: key === today });
    }

    months.set(monthKey, { monthKey, visits, visitedDayCount, daysInMonth, cells });
  }

  return [...months.values()].sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}

/** Flat 30-day strip for the admin member panel. Oldest first. */
export function last30Days(
  checkIns: readonly { checked_in_at: string }[],
  now: Date = new Date(),
): Array<{ key: string; visited: boolean }> {
  const days = visitedDays(checkIns);
  const today = gymTodayKey(now);

  return Array.from({ length: 30 }, (_, i) => {
    const key = shiftDay(today, i - 29);
    return { key, visited: days.has(key) };
  });
}
