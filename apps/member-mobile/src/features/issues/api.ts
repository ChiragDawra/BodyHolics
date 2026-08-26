import { supabase } from '@/lib/supabase';
import { invokeFunction } from '@/lib/functions';

/** docs/07 §7 — reads direct under RLS, writes through Edge Functions. */
export async function fetchMyIssues() {
  const { data, error } = await supabase
    .from('issues')
    .select('id, title, category, status, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw new Error('Could not load your reports.');
  return data ?? [];
}

export function createIssue(input: {
  category: 'EQUIPMENT' | 'CLEANLINESS' | 'STAFF' | 'BILLING' | 'SAFETY' | 'OTHER';
  title: string;
  description: string;
}) {
  return invokeFunction<{ issueId: string; status: string; createdAt: string }>(
    'create-issue',
    input,
  );
}

export function replyToIssue(input: { issueId: string; body: string }) {
  return invokeFunction<{ issueId: string; status: string }>('reply-to-issue', input);
}
