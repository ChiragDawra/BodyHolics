import { supabase } from '@/lib/supabase';

/**
 * docs/07 §6 — alerts are read directly, RLS-scoped to the caller. There is no
 * gym filter here on purpose: the policy is `user_id = auth.uid()`, so the only
 * rows that exist for this caller are their own.
 */
export async function fetchNotifications() {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, title, body, category, source_type, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw new Error('Could not load your alerts.');
  return data ?? [];
}

export async function fetchUnreadCount() {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);

  return count ?? 0;
}

/**
 * Only `read_at` is writable, and that is enforced by a column grant rather than
 * by this function being polite about it — the policy alone would let a member
 * rewrite the title and body of their own notification (docs/05 §8).
 */
export async function markRead(id: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error('Could not mark that as read.');
}
