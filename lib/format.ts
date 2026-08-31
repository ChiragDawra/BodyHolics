import { GYM_TIME_ZONE } from "@/lib/gym";

/** "14 March" — how a member would say a date, not a timestamp. */
export function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: GYM_TIME_ZONE,
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}

/** "14 March 2027" — used when the year is not obvious. */
export function formatFullDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: GYM_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

/** "March 2027" — month headings in the activity list. */
export function formatMonth(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: GYM_TIME_ZONE,
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

/** "6:45 pm" */
export function formatClock(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: GYM_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(new Date(iso))
    .replace(/\s?([ap])m/i, (_, p: string) => ` ${p.toLowerCase()}m`);
}

/** "just now", "20 minutes ago", "yesterday", "on 3 March". */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const seconds = Math.round((now.getTime() - then.getTime()) / 1000);

  // A timestamp in the future is not "just now" — that reads as a lie next to
  // a check-in that has not happened yet. Show the clock time instead.
  if (seconds < 0) return formatClock(iso);

  if (seconds < 60) return "just now";
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    return m === 1 ? "a minute ago" : `${m} minutes ago`;
  }
  if (seconds < 86_400) {
    const h = Math.floor(seconds / 3600);
    return h === 1 ? "an hour ago" : `${h} hours ago`;
  }
  if (seconds < 172_800) return "yesterday";
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)} days ago`;

  return `on ${formatDay(iso)}`;
}

/** Whole days from today until a date, floored at zero. */
export function daysUntil(dateOnly: string, now: Date = new Date()): number {
  const target = new Date(`${dateOnly}T00:00:00+05:30`).getTime();
  const today = new Date(
    new Intl.DateTimeFormat("en-CA", { timeZone: GYM_TIME_ZONE }).format(now) +
      "T00:00:00+05:30",
  ).getTime();

  return Math.max(0, Math.round((target - today) / 86_400_000));
}

/** Today's date in the gym's timezone, as YYYY-MM-DD. */
export function gymToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: GYM_TIME_ZONE }).format(now);
}
