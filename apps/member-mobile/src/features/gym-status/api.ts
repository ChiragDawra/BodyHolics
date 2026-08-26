import { getFunction } from '@/lib/functions';

import type { GymStatus } from './types';

/**
 * Resolved server-side from the schedule, any active override, and the gym's own
 * timezone. The client never computes this — "today" depends on gyms.timezone,
 * not on the phone's clock or locale (CLAUDE.md rule 7).
 */
export function fetchGymStatus(gymId: string) {
  return getFunction<GymStatus>('current-gym-status', { gymId });
}
