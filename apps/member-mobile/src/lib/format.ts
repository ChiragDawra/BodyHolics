import { formatInTimeZone } from 'date-fns-tz';

/**
 * Money formatting lives in packages/domain so both clients render the same
 * number the same way — en-IN groups as 2,2,3 (lakh/crore), not 3,3,3, and two
 * hand-rolled copies of that will not stay in agreement.
 */
export { formatPaise } from '@gym/domain';

/**
 * The gym's timezone, never the device's. A member travelling does not change
 * when their gym opens, and the phone's clock is not the source of truth
 * (CLAUDE.md rule 7).
 */
export function formatInGymZone(iso: string, timeZone: string, pattern = 'd MMM yyyy'): string {
  return formatInTimeZone(iso, timeZone, pattern);
}

export function formatTimeInGymZone(iso: string, timeZone: string): string {
  return formatInTimeZone(iso, timeZone, 'h:mm a');
}
