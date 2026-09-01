import type { Database } from "@/lib/supabase/database.types";

export type CrowdLevel = Database["public"]["Enums"]["crowd_level"];

export const CROWD_LEVELS: readonly CrowdLevel[] = [
  "not_crowded",
  "moderate",
  "crowded",
  "very_crowded",
] as const;

/** Token class per crowd bucket. Semantic, so a palette change cannot break it. */
export const CROWD_TEXT: Record<CrowdLevel, string> = {
  not_crowded: "text-crowd-low",
  moderate: "text-crowd-mid",
  crowded: "text-crowd-high",
  very_crowded: "text-crowd-peak",
};

export const CROWD_BG: Record<CrowdLevel, string> = {
  not_crowded: "bg-crowd-low",
  moderate: "bg-crowd-mid",
  crowded: "bg-crowd-high",
  very_crowded: "bg-crowd-peak",
};

/** How many of the four segments are lit. */
export const CROWD_FILL: Record<CrowdLevel, number> = {
  not_crowded: 1,
  moderate: 2,
  crowded: 3,
  very_crowded: 4,
};

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export const DAY_KEYS: readonly DayKey[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;

export const DAY_LABELS: Record<DayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

/** Two-letter column headings on the activity grid. */
export const DAY_INITIALS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

export type DayHours = { open: string; close: string } | null;
export type WeeklyHours = Partial<Record<DayKey, DayHours>>;

/**
 * The gym is in one Indian city, so every "today" and "now" in the app is
 * Asia/Kolkata regardless of where the phone thinks it is. A member opening
 * the app on a phone still set to another timezone must not see the wrong
 * open/closed state.
 */
export const GYM_TIME_ZONE = "Asia/Kolkata";

function gymParts(now: Date) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: GYM_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";

  const weekday = get("weekday").toLowerCase().slice(0, 3) as DayKey;
  const minutes = Number(get("hour")) * 60 + Number(get("minute"));

  return { weekday, minutes };
}

/** ISO weekday in the gym's timezone: Monday = 1 … Sunday = 7. */
export function gymIsoWeekday(now: Date = new Date()): number {
  const index = DAY_KEYS.indexOf(gymParts(now).weekday);
  return index === -1 ? 1 : index + 1;
}

export function gymWeekdayLabel(now: Date = new Date()): string {
  const key = gymParts(now).weekday;
  return DAY_LABELS[key] ?? DAY_LABELS.mon;
}

function toMinutes(hhmm: string): number | null {
  const [h, m] = hhmm.split(":");
  if (h === undefined || m === undefined) return null;
  const hours = Number(h);
  const mins = Number(m);
  if (Number.isNaN(hours) || Number.isNaN(mins)) return null;
  return hours * 60 + mins;
}

/** "18:30" as the gym would say it: "6:30 pm". */
export function formatTime(hhmm: string): string {
  const total = toMinutes(hhmm);
  if (total === null) return hhmm;

  const hours = Math.floor(total / 60);
  const mins = total % 60;
  const suffix = hours >= 12 ? "pm" : "am";
  const display = hours % 12 === 0 ? 12 : hours % 12;

  return mins === 0
    ? `${display} ${suffix}`
    : `${display}:${String(mins).padStart(2, "0")} ${suffix}`;
}

/** A bare hour number as the gym would say it: 20 -> "8 pm". */
export function formatHour(hour: number): string {
  const suffix = hour >= 12 ? "pm" : "am";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${suffix}`;
}

export type OpenState = {
  isOpen: boolean;
  /** True when a staff override is deciding this, not the schedule. */
  overridden: boolean;
  today: DayHours;
  /** Set when closed and the gym opens again later today. */
  opensAt: string | null;
  /** Set when open. */
  closesAt: string | null;
};

/**
 * Whether the gym is open right now.
 *
 * `is_open_override` beats the schedule in both directions: true forces open,
 * false forces closed, null follows weekly_hours.
 */
export function resolveOpenState(
  weeklyHours: WeeklyHours,
  isOpenOverride: boolean | null,
  now: Date = new Date(),
): OpenState {
  const { weekday, minutes } = gymParts(now);
  const today = weeklyHours[weekday] ?? null;

  if (isOpenOverride !== null) {
    return {
      isOpen: isOpenOverride,
      overridden: true,
      today,
      opensAt: !isOpenOverride && today ? today.open : null,
      closesAt: isOpenOverride && today ? today.close : null,
    };
  }

  if (!today) {
    return { isOpen: false, overridden: false, today: null, opensAt: null, closesAt: null };
  }

  const open = toMinutes(today.open);
  const close = toMinutes(today.close);
  if (open === null || close === null) {
    return { isOpen: false, overridden: false, today, opensAt: null, closesAt: null };
  }

  const isOpen = minutes >= open && minutes < close;

  return {
    isOpen,
    overridden: false,
    today,
    opensAt: !isOpen && minutes < open ? today.open : null,
    closesAt: isOpen ? today.close : null,
  };
}

/** Parses the jsonb column into something typed, tolerating a malformed row. */
export function parseWeeklyHours(value: unknown): WeeklyHours {
  if (typeof value !== "object" || value === null) return {};
  const out: WeeklyHours = {};

  for (const day of DAY_KEYS) {
    const raw = (value as Record<string, unknown>)[day];
    if (typeof raw !== "object" || raw === null) {
      out[day] = null;
      continue;
    }
    const { open, close } = raw as Record<string, unknown>;
    out[day] =
      typeof open === "string" && typeof close === "string" ? { open, close } : null;
  }

  return out;
}

/** "9876543210" -> "+91 98765 43210". Leaves anything unexpected alone. */
export function formatPhone(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  if (local.length !== 10) return raw;
  return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
}
