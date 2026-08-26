export type DayCount = { date: string; visits: number };

export type AttendanceSummary = {
  /** Distinct members currently inside, for staff only (docs/05 §5). */
  currentlyInside: number;
  visitsToday: number;
  visitsThisWeek: number;
  byDay: DayCount[];
  byHour: { hour: number; visits: number }[];
};
