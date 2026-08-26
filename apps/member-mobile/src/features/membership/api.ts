import { supabase } from '@/lib/supabase';

/**
 * Reads go direct through PostgREST under RLS (docs/07 §Transport). The view is
 * the single definition of "valid right now" (D-011) — never `status = 'ACTIVE'`
 * on its own, which is stale between the hourly expiry job and reality.
 */
export async function fetchCurrentMembership(gymId: string) {
  const { data, error } = await supabase
    .from('v_current_memberships')
    .select('id, plan_id, status, end_at, days_remaining, is_expiring, price_paise')
    .eq('gym_id', gymId)
    .order('end_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error('Could not load your membership.');
  return data;
}

export async function fetchPlans(gymId: string) {
  const { data, error } = await supabase
    .from('membership_plans')
    .select('id, name, description, price_paise, duration_days')
    .eq('gym_id', gymId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw new Error('Could not load the plans.');
  return data ?? [];
}

export async function fetchPendingPayment(gymId: string) {
  const { data } = await supabase
    .from('payments')
    .select('id, amount_paise, method, status, created_at')
    .eq('gym_id', gymId)
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}
