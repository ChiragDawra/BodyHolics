import { useQuery } from '@tanstack/react-query';
import { fetchGymStatus } from './api';

/** docs/06 §7 — gym status is cheap and changes; 60s. */
export function useGymStatus(gymId: string | null) {
  return useQuery({
    queryKey: ['gym-status', gymId],
    queryFn: () => fetchGymStatus(gymId!),
    enabled: Boolean(gymId),
    staleTime: 60_000,
  });
}
