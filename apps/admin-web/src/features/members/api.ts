import { createClient } from '@/lib/supabase/server';
import { maskPhone } from '@/lib/format';
import type { MemberDetail, MemberListRow, MemberStatus } from './types';

/**
 * docs/01 — admin can view, search and edit existing members. There is no
 * "Add member" path here and there must not be one: registration is member-led
 * via QR + OTP (CLAUDE.md rule 9).
 */

type CurrentRow = { user_id: string | null; end_at: string | null; days_remaining: number | null; is_expiring: boolean | null };

function statusFor(
  current: CurrentRow | undefined,
  hasPending: boolean,
): { membershipStatus: MemberStatus; endAt: string | null; daysRemaining: number | null } {
  if (current) {
    return {
      membershipStatus: current.is_expiring ? 'EXPIRING' : 'ACTIVE',
      endAt: current.end_at,
      daysRemaining: current.days_remaining,
    };
  }
  if (hasPending) return { membershipStatus: 'PENDING_PAYMENT', endAt: null, daysRemaining: null };
  return { membershipStatus: 'NONE', endAt: null, daysRemaining: null };
}

export async function listMembers(
  gymId: string,
  query: string,
): Promise<MemberListRow[]> {
  const supabase = await createClient();

  // Explicit columns. `select *` on profiles would put every member's phone
  // number in the response for a list that only renders a masked one.
  let membersQuery = supabase
    .from('gym_members')
    .select('user_id, member_code, joined_at, status, profiles!inner(full_name, phone)')
    .eq('gym_id', gymId)
    .order('joined_at', { ascending: false })
    .limit(200);

  const trimmed = query.trim();
  if (trimmed.length > 0) {
    // Escape the PostgREST `or` separators so a comma or a paren in the search
    // box cannot restructure the filter expression.
    const safe = trimmed.replace(/[,()]/g, ' ');
    membersQuery = membersQuery.or(
      `member_code.ilike.%${safe}%,profiles.full_name.ilike.%${safe}%`,
    );
  }

  const [members, current, pending] = await Promise.all([
    membersQuery,
    supabase
      .from('v_current_memberships')
      .select('user_id, end_at, days_remaining, is_expiring')
      .eq('gym_id', gymId),
    supabase
      .from('memberships')
      .select('user_id')
      .eq('gym_id', gymId)
      .eq('status', 'PENDING_PAYMENT'),
  ]);

  if (members.error) throw new Error('Could not load members.');

  // A member can hold stacked memberships; the one that matters is the latest.
  const currentByUser = new Map<string, CurrentRow>();
  for (const row of current.data ?? []) {
    if (!row.user_id) continue;
    const existing = currentByUser.get(row.user_id);
    if (!existing || (row.end_at ?? '') > (existing.end_at ?? '')) {
      currentByUser.set(row.user_id, row);
    }
  }
  const pendingUsers = new Set((pending.data ?? []).map((row) => row.user_id));

  return (members.data ?? []).map((row) => {
    const derived = statusFor(currentByUser.get(row.user_id), pendingUsers.has(row.user_id));
    return {
      userId: row.user_id,
      memberCode: row.member_code,
      fullName: row.profiles.full_name,
      maskedPhone: maskPhone(row.profiles.phone),
      joinedAt: row.joined_at,
      ...derived,
    };
  });
}

export async function getMember(gymId: string, userId: string): Promise<MemberDetail | null> {
  const supabase = await createClient();

  const [member, current, memberships, payments] = await Promise.all([
    supabase
      .from('gym_members')
      .select('user_id, member_code, joined_at, status, profiles!inner(full_name, phone)')
      .eq('gym_id', gymId)
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('v_current_memberships')
      .select('user_id, end_at, days_remaining, is_expiring')
      .eq('gym_id', gymId)
      .eq('user_id', userId)
      .order('end_at', { ascending: false })
      .limit(1),
    supabase
      .from('memberships')
      .select('id, status, price_paise, start_at, end_at, membership_plans(name)')
      .eq('gym_id', gymId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('payments')
      .select('id, amount_paise, method, status, paid_at, created_at')
      .eq('gym_id', gymId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ]);

  if (!member.data) return null;

  const currentRow = current.data?.[0];
  const hasPending = (memberships.data ?? []).some((row) => row.status === 'PENDING_PAYMENT');
  const derived = statusFor(currentRow, hasPending);

  return {
    userId: member.data.user_id,
    memberCode: member.data.member_code,
    fullName: member.data.profiles.full_name,
    maskedPhone: maskPhone(member.data.profiles.phone),
    joinedAt: member.data.joined_at,
    gymMemberStatus: member.data.status as 'ACTIVE' | 'BLOCKED',
    ...derived,
    memberships: (memberships.data ?? []).map((row) => ({
      id: row.id,
      planName: row.membership_plans?.name ?? 'Plan',
      status: row.status,
      pricePaise: row.price_paise,
      startAt: row.start_at,
      endAt: row.end_at,
    })),
    payments: (payments.data ?? []).map((row) => ({
      id: row.id,
      amountPaise: row.amount_paise,
      method: row.method,
      status: row.status,
      paidAt: row.paid_at,
      createdAt: row.created_at,
    })),
  };
}
