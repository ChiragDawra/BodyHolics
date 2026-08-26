import { useQuery } from '@tanstack/react-query';
import { fetchCurrentMembership, fetchPendingPayment, fetchPlans } from './api';

/** docs/06 §7 — membership 5 min, plans 30 min, a pending payment not at all. */
export function useCurrentMembership(gymId: string | null) {
  return useQuery({
    queryKey: ['membership', gymId],
    queryFn: () => fetchCurrentMembership(gymId!),
    enabled: Boolean(gymId),
    staleTime: 5 * 60_000,
  });
}

export function usePlans(gymId: string | null) {
  return useQuery({
    queryKey: ['plans', gymId],
    queryFn: () => fetchPlans(gymId!),
    enabled: Boolean(gymId),
    staleTime: 30 * 60_000,
  });
}

export function usePendingPayment(gymId: string | null) {
  return useQuery({
    queryKey: ['pending-payment', gymId],
    queryFn: () => fetchPendingPayment(gymId!),
    enabled: Boolean(gymId),
    // Zero while a payment is in flight: the member is watching this change.
    staleTime: 0,
  });
}
