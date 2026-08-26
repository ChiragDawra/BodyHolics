import { useMutation, useQuery } from '@tanstack/react-query';
import { createCounterToken, createPaymentOrder, fetchPaymentStatus } from './api';

export function useCreateOrder() {
  return useMutation({ mutationFn: createPaymentOrder });
}

/**
 * Polls while the payment is in flight. It stops on its own once the payment
 * reaches a terminal state — a screen left open must not poll forever.
 */
export function usePaymentStatus(paymentId: string | null) {
  return useQuery({
    queryKey: ['payment-status', paymentId],
    queryFn: () => fetchPaymentStatus(paymentId!),
    enabled: Boolean(paymentId),
    staleTime: 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status) return 3000;
      return status === 'PENDING' || status === 'AUTHORIZED' ? 3000 : false;
    },
  });
}

export function useCounterToken() {
  return useMutation({ mutationFn: createCounterToken });
}
