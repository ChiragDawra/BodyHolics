import { createClient } from '@/lib/supabase/server';
import type { PaymentRow, PaymentTotals } from './types';

const STATUSES = ['PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED'] as const;
export type PaymentStatusFilter = (typeof STATUSES)[number] | 'ALL';

export function parseStatusFilter(value: string | undefined): PaymentStatusFilter {
  // Anything unrecognised falls back to ALL rather than reaching the query, so a
  // hand-edited URL cannot inject a value into the filter.
  return (STATUSES as readonly string[]).includes(value ?? '')
    ? (value as PaymentStatusFilter)
    : 'ALL';
}

export async function listPayments(
  gymId: string,
  status: PaymentStatusFilter,
): Promise<{ rows: PaymentRow[]; totals: PaymentTotals }> {
  const supabase = await createClient();

  let query = supabase
    .from('payments')
    .select(
      'id, user_id, amount_paise, method, status, created_at, paid_at, confirmed_by, profiles!payments_user_id_fkey(full_name)',
    )
    .eq('gym_id', gymId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (status !== 'ALL') query = query.eq('status', status);

  const [payments, codes, totals] = await Promise.all([
    query,
    supabase.from('gym_members').select('user_id, member_code').eq('gym_id', gymId),
    supabase.from('payments').select('amount_paise, status').eq('gym_id', gymId),
  ]);

  if (payments.error) throw new Error('Could not load payments.');

  const confirmerIds = [
    ...new Set((payments.data ?? []).map((row) => row.confirmed_by).filter((v): v is string => !!v)),
  ];
  const confirmerNames = new Map<string, string>();
  if (confirmerIds.length > 0) {
    const { data } = await supabase.from('profiles').select('id, full_name').in('id', confirmerIds);
    for (const row of data ?? []) confirmerNames.set(row.id, row.full_name);
  }

  const codeByUser = new Map((codes.data ?? []).map((row) => [row.user_id, row.member_code]));

  const rows: PaymentRow[] = (payments.data ?? []).map((row) => ({
    id: row.id,
    memberName: row.profiles?.full_name ?? 'Member',
    memberCode: codeByUser.get(row.user_id) ?? null,
    amountPaise: row.amount_paise,
    method: row.method,
    status: row.status,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    confirmedByName: row.confirmed_by ? (confirmerNames.get(row.confirmed_by) ?? null) : null,
  }));

  const all = totals.data ?? [];
  return {
    rows,
    totals: {
      // Revenue is the sum of settled payments, never of plan prices (docs/05 §10).
      paidPaise: all
        .filter((row) => row.status === 'PAID')
        .reduce((sum, row) => sum + row.amount_paise, 0),
      pendingCount: all.filter((row) => row.status === 'PENDING').length,
      failedCount: all.filter((row) => row.status === 'FAILED').length,
    },
  };
}
