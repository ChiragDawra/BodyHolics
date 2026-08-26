import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { startOfMonth } from 'date-fns';
import { createClient } from '@/lib/supabase/server';
import type { AttentionItem, DashboardKpis } from './types';

/**
 * docs/05 §10. Every count is scoped by RLS to the caller's own gym, and the
 * gym_id filter is belt-and-braces on top of that rather than the thing doing
 * the work.
 *
 * Month boundaries are computed in the gym's timezone and then converted back to
 * UTC for the query (CLAUDE.md rule 7). Using the server's month would put the
 * first five and a half hours of every Indian month into the previous one.
 */
export async function getDashboardKpis(gymId: string, timeZone: string): Promise<DashboardKpis> {
  const supabase = await createClient();

  const monthStartUtc = fromZonedTime(startOfMonth(toZonedTime(new Date(), timeZone)), timeZone);
  const monthStartIso = monthStartUtc.toISOString();

  const [current, members, joined, revenue, expiring, pending, issues] = await Promise.all([
    supabase
      .from('v_current_memberships')
      .select('user_id', { count: 'exact', head: false })
      .eq('gym_id', gymId),
    supabase
      .from('gym_members')
      .select('id', { count: 'exact', head: true })
      .eq('gym_id', gymId)
      .eq('status', 'ACTIVE'),
    supabase
      .from('gym_members')
      .select('id', { count: 'exact', head: true })
      .eq('gym_id', gymId)
      .gte('joined_at', monthStartIso),
    // Revenue is summed from settled payments, never from plan prices: a
    // discounted or partially refunded month would otherwise read as full price.
    supabase
      .from('payments')
      .select('amount_paise')
      .eq('gym_id', gymId)
      .eq('status', 'PAID')
      .gte('paid_at', monthStartIso),
    supabase
      .from('v_current_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('gym_id', gymId)
      .eq('is_expiring', true),
    supabase
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .eq('gym_id', gymId)
      .eq('status', 'PENDING'),
    supabase
      .from('issues')
      .select('id', { count: 'exact', head: true })
      .eq('gym_id', gymId)
      .in('status', ['OPEN', 'IN_PROGRESS']),
  ]);

  // A member with two stacked memberships is one active member, not two.
  const activeMembers = new Set((current.data ?? []).map((row) => row.user_id)).size;
  const totalMembers = members.count ?? 0;

  return {
    activeMembers,
    inactiveMembers: Math.max(0, totalMembers - activeMembers),
    newThisMonth: joined.count ?? 0,
    revenueThisMonthPaise: (revenue.data ?? []).reduce((sum, row) => sum + row.amount_paise, 0),
    expiringSoon: expiring.count ?? 0,
    pendingPayments: pending.count ?? 0,
    openIssues: issues.count ?? 0,
  };
}

/**
 * The queue on the overview page. It answers "what needs a person today",
 * which is a different question from "what are the totals".
 */
export async function getAttentionQueue(gymId: string): Promise<AttentionItem[]> {
  const supabase = await createClient();

  const [expiring, pending, issues] = await Promise.all([
    // A view carries no foreign keys, so PostgREST cannot embed the profile
    // through it. The names are fetched in a second pass below.
    supabase
      .from('v_current_memberships')
      .select('id, user_id, end_at, days_remaining')
      .eq('gym_id', gymId)
      .eq('is_expiring', true)
      .order('end_at', { ascending: true })
      .limit(5),
    supabase
      .from('payments')
      .select('id, amount_paise, created_at, method, profiles:user_id(full_name)')
      .eq('gym_id', gymId)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true })
      .limit(5),
    supabase
      .from('issues')
      .select('id, title, category, created_at')
      .eq('gym_id', gymId)
      .eq('status', 'OPEN')
      .order('created_at', { ascending: true })
      .limit(5),
  ]);

  const items: AttentionItem[] = [];

  const expiringRows = (expiring.data ?? []).filter(
    (row): row is typeof row & { id: string; user_id: string } =>
      row.id !== null && row.user_id !== null,
  );

  // Explicit columns only — a `select *` here would pull every member's phone
  // number into the dashboard render (CLAUDE.md §8).
  const names = new Map<string, string>();
  if (expiringRows.length > 0) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in(
        'id',
        expiringRows.map((row) => row.user_id),
      );
    for (const profile of data ?? []) names.set(profile.id, profile.full_name);
  }

  for (const row of expiringRows) {
    items.push({
      id: `expiring-${row.id}`,
      kind: 'EXPIRING',
      title: names.get(row.user_id) ?? 'Member',
      detail:
        row.days_remaining === 0
          ? 'Membership ends today'
          : `Membership ends in ${row.days_remaining} day${row.days_remaining === 1 ? '' : 's'}`,
      href: `/members/${row.user_id}`,
    });
  }

  for (const row of pending.data ?? []) {
    items.push({
      id: `payment-${row.id}`,
      kind: 'PENDING_PAYMENT',
      title: row.profiles?.full_name ?? 'Member',
      detail: `Payment still pending (${row.method.toLowerCase().replace('_', ' ')})`,
      href: '/payments',
    });
  }

  for (const row of issues.data ?? []) {
    items.push({
      id: `issue-${row.id}`,
      kind: 'OPEN_ISSUE',
      title: row.title,
      detail: `Unacknowledged ${row.category.toLowerCase()} issue`,
      href: `/issues/${row.id}`,
    });
  }

  return items;
}
