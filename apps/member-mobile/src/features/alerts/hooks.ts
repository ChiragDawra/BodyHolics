import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchNotifications, fetchUnreadCount, markRead } from './api';

export function useNotifications() {
  return useQuery({ queryKey: ['notifications'], queryFn: fetchNotifications, staleTime: 30_000 });
}

export function useUnreadCount() {
  return useQuery({ queryKey: ['notifications', 'unread'], queryFn: fetchUnreadCount, staleTime: 30_000 });
}

export function useMarkRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: markRead,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
