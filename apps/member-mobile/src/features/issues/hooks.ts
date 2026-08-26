import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createIssue, fetchMyIssues, replyToIssue } from './api';

export function useMyIssues() {
  return useQuery({ queryKey: ['issues'], queryFn: fetchMyIssues, staleTime: 60_000 });
}

export function useCreateIssue() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createIssue,
    onSuccess: () => void client.invalidateQueries({ queryKey: ['issues'] }),
  });
}

export function useReplyToIssue() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: replyToIssue,
    onSuccess: () => void client.invalidateQueries({ queryKey: ['issues'] }),
  });
}
