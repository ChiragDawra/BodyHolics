import { getFunction } from '@/lib/functions';

import type { Crowd } from './types';

/**
 * A bucket, never a headcount. The endpoint does not return sampleSize to a
 * member and the underlying function is revoked from `authenticated` precisely
 * so it cannot (docs/05 §5).
 */
export function fetchCrowd(gymId: string) {
  return getFunction<Crowd>('current-crowd', { gymId });
}
