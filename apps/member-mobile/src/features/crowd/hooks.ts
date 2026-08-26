import { useQuery } from '@tanstack/react-query';
import { fetchCrowd } from './api';

export function useCrowd(gymId: string | null) {
  return useQuery({
    queryKey: ['crowd', gymId],
    queryFn: () => fetchCrowd(gymId!),
    enabled: Boolean(gymId),
    // The snapshot job runs every ten minutes, so anything finer is wasted work.
    staleTime: 2 * 60_000,
  });
}
