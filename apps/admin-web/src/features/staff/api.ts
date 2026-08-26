import { createClient } from '@/lib/supabase/server';

export type StaffRow = {
  userId: string;
  fullName: string;
  role: 'OWNER' | 'STAFF';
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
};

/**
 * The staff roster.
 *
 * docs/04 §4 — a staff account is a normal auth.users row; the gym_staff row is
 * what grants power, and removing power means `status = 'DISABLED'`, which takes
 * effect on the next request because `is_gym_staff()` reads live. There is no
 * "invite staff" flow here: the first OWNER is a manual audited insert per
 * environment, deliberately not a signup.
 */
export async function listStaff(gymId: string): Promise<StaffRow[]> {
  const supabase = await createClient();

  // Explicit columns — no phone number is needed to render a roster.
  const { data, error } = await supabase
    .from('gym_staff')
    .select('user_id, role, status, created_at, profiles(full_name)')
    .eq('gym_id', gymId)
    .order('created_at', { ascending: true });

  if (error) throw new Error('Could not load the staff list.');

  return (data ?? []).map((row) => ({
    userId: row.user_id,
    fullName: row.profiles?.full_name ?? 'Staff member',
    role: row.role as 'OWNER' | 'STAFF',
    status: row.status as 'ACTIVE' | 'DISABLED',
    createdAt: row.created_at,
  }));
}
