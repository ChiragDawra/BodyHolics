import type { Database } from "@/lib/supabase/database.types";

export type CrowdLevel = Database["public"]["Enums"]["crowd_level"];

export const CROWD_LEVELS = [
  "not_crowded",
  "moderate",
  "crowded",
  "very_crowded",
] as const satisfies readonly CrowdLevel[];

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

/**
 * A stretch of the day the gym is open. Opening hours are a list of these,
 * not one range per day: this gym runs 5:30–11:30 and again 16:00–22:00, and
 * a single { open, close } pair would have to claim it is open at 2pm.
 *
 * `day_of_week` is ISO — Monday = 1 … Sunday = 7 — matching `gymIsoWeekday()`
 * and the column of the same name. Postgres's own `extract(dow)` is Sunday=0;
 * this is deliberately not that.
 *
 * Times arrive from Postgres `time` columns as "05:30:00". Everything here
 * reads hours and minutes and ignores the seconds.
 */
export type HourBlock = {
  day_of_week: number;
  start_time: string;
  end_time: string;
};

/** One row of the weekly crowd timetable. */
export type CrowdSlot = HourBlock & { level: CrowdLevel };

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

export function toMinutes(hhmm: string): number | null {
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

/** Today's blocks, earliest first. */
export function blocksForDay<T extends HourBlock>(
  blocks: readonly T[],
  isoWeekday: number,
): T[] {
  return blocks
    .filter((b) => b.day_of_week === isoWeekday)
    .sort((a, b) => (toMinutes(a.start_time) ?? 0) - (toMinutes(b.start_time) ?? 0));
}

export type OpenState = {
  isOpen: boolean;
  /** True when a staff override is deciding this, not the schedule. */
  overridden: boolean;
  /** Every block for today, in order. Empty means closed all day. */
  todayBlocks: HourBlock[];
  /** Set when closed and the gym opens again later today. */
  opensAt: string | null;
  /** Set when open. */
  closesAt: string | null;
};

/**
 * Whether the gym is open right now.
 *
 * Open means now falls inside *any* of today's blocks — the midday gap
 * between the morning and evening sessions is closed, and so is anything
 * before the first block or after the last.
 *
 * `is_open_override` beats the schedule in both directions: true forces open,
 * false forces closed, null follows the blocks.
 */
export function resolveOpenState(
  blocks: readonly HourBlock[],
  isOpenOverride: boolean | null,
  now: Date = new Date(),
): OpenState {
  const { minutes } = gymParts(now);
  const todayBlocks = blocksForDay(blocks, gymIsoWeekday(now));

  const current = todayBlocks.find((b) => {
    const open = toMinutes(b.start_time);
    const close = toMinutes(b.end_time);
    return open !== null && close !== null && minutes >= open && minutes < close;
  });

  const next = todayBlocks.find((b) => {
    const open = toMinutes(b.start_time);
    return open !== null && open > minutes;
  });

  if (isOpenOverride !== null) {
    return {
      isOpen: isOpenOverride,
      overridden: true,
      todayBlocks,
      // Forced closed, but the schedule still says when it would reopen.
      opensAt: !isOpenOverride ? (next?.start_time ?? null) : null,
      closesAt: isOpenOverride ? (current?.end_time ?? null) : null,
    };
  }

  return {
    isOpen: current !== undefined,
    overridden: false,
    todayBlocks,
    opensAt: current === undefined ? (next?.start_time ?? null) : null,
    closesAt: current?.end_time ?? null,
  };
}

export type CrowdState = {
  level: CrowdLevel;
  /** True when a staff override is deciding this, not the schedule. */
  overridden: boolean;
};

/**
 * How busy the gym is right now.
 *
 * This is a timetable the owner maintains, never a headcount and never
 * anything sensed from a device — the same hours are busy every Tuesday, and
 * asking the desk to remember to update a live figure is asking for a figure
 * that is always wrong.
 *
 * `crowd_override` beats the timetable, the same shape as
 * `is_open_override` beating the hours. Outside every scheduled slot the
 * honest answer is the quiet one: those are the hours nobody is here.
 */
export function resolveCrowdLevel(
  slots: readonly CrowdSlot[],
  crowdOverride: CrowdLevel | null,
  now: Date = new Date(),
): CrowdState {
  if (crowdOverride !== null) {
    return { level: crowdOverride, overridden: true };
  }

  const { minutes } = gymParts(now);

  const current = blocksForDay(slots, gymIsoWeekday(now)).find((slot) => {
    const from = toMinutes(slot.start_time);
    const to = toMinutes(slot.end_time);
    return from !== null && to !== null && minutes >= from && minutes < to;
  });

  return { level: current?.level ?? "not_crowded", overridden: false };
}

/** "9876543210" -> "+91 98765 43210". Leaves anything unexpected alone. */
export function formatPhone(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  if (local.length !== 10) return raw;
  return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
}
