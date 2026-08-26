import { fromZonedTime, toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { startOfDay, subDays } from 'date-fns';
import { createClient } from '@/lib/supabase/server';
import type { AttendanceSummary, DayCount } from './types';

/**
 * Floor traffic, for staff.
 *
 * Unlike the member-facing crowd endpoint, this is allowed to show real counts:
 * docs/05 §5 forbids an exact headcount reaching a *member*, not an operator
 * deciding when to staff the desk. It is still RLS-scoped to the caller's gym.
 *
 * Every bucket boundary is computed in the gym's timezone and converted back to
 * UTC for the query. Bucketing by the server's day would put every early-morning
 * session in Bengaluru on the previous date.
 */
export async function getAttendanceSummary(
  gymId: string,
  timeZone: string,
): Promise<AttendanceSummary> {
  const supabase = await createClient();

  const nowLocal = toZonedTime(new Date(), timeZone);
  const since = fromZonedTime(startOfDay(subDays(nowLocal, 29)), timeZone);
  const todayStart = fromZonedTime(startOfDay(nowLocal), timeZone);
  const weekStart = fromZonedTime(startOfDay(subDays(nowLocal, 6)), timeZone);

  const { data, error } = await supabase
    .from('attendance_events')
    .select('user_id, occurred_at, event_type')
    .eq('gym_id', gymId)
    .gte('occurred_at', since.toISOString())
    .order('occurred_at', { ascending: true });

  if (error) throw new Error('Could not load attendance.');

  const arrivals = (data ?? []).filter(
    (row) => row.event_type === 'PRESENCE_START' || row.event_type === 'CHECK_IN',
  );

  const byDayMap = new Map<string, number>();
  const byHourMap = new Map<number, number>();

  for (const row of arrivals) {
    const day = formatInTimeZone(row.occurred_at, timeZone, 'yyyy-MM-dd');
    byDayMap.set(day, (byDayMap.get(day) ?? 0) + 1);

    const hour = Number(formatInTimeZone(row.occurred_at, timeZone, 'H'));
    byHourMap.set(hour, (byHourMap.get(hour) ?? 0) + 1);
  }

  const byDay: DayCount[] = [];
  for (let offset = 29; offset >= 0; offset -= 1) {
    const day = formatInTimeZone(
      fromZonedTime(startOfDay(subDays(nowLocal, offset)), timeZone),
      timeZone,
      'yyyy-MM-dd',
    );
    byDay.push({ date: day, visits: byDayMap.get(day) ?? 0 });
  }

  // Distinct members, not events: someone who started two sessions today is one
  // person through the door twice, but one member either way for occupancy.
  const insideNow = new Set<string>();
  for (const row of data ?? []) {
    if (!row.user_id) continue;
    if (row.event_type === 'PRESENCE_START' || row.event_type === 'CHECK_IN') {
      insideNow.add(row.user_id);
    } else {
      insideNow.delete(row.user_id);
    }
  }

  return {
    currentlyInside: insideNow.size,
    visitsToday: arrivals.filter((row) => row.occurred_at >= todayStart.toISOString()).length,
    visitsThisWeek: arrivals.filter((row) => row.occurred_at >= weekStart.toISOString()).length,
    byDay,
    byHour: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      visits: byHourMap.get(hour) ?? 0,
    })),
  };
}
