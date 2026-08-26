export type HoursRow = {
  weekday: number;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
};

export type HoursActionResult =
  | { status: 'idle' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

/** 0 = Sunday, matching Postgres `extract(dow)` and the gym_hours check. */
export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;
