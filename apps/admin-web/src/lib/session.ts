import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';

export type StaffSession = {
  userId: string;
  fullName: string;
  gymId: string;
  gymName: string;
  gymSlug: string;
  timezone: string;
  role: 'OWNER' | 'STAFF';
};

/**
 * Resolves who is signed in and which gym they staff.
 *
 * The role comes from `gym_staff`, read live on every request — never from a JWT
 * claim and never from a cached flag (docs/04 §4). Revoking access is a single
 * `status = 'DISABLED'` update, and it must take effect on the next page load,
 * not on the next login.
 *
 * Returns null rather than throwing when the user is signed in but is not staff,
 * so the caller decides between "send to login" and "show a plain refusal".
 */
export async function getStaffSession(): Promise<StaffSession | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Explicit columns: `select *` on a joined profile would pull the phone number
  // into every page render for no reason (CLAUDE.md §8).
  const { data, error } = await supabase
    .from('gym_staff')
    .select('role, gym_id, gyms(name, slug, timezone), profiles(full_name)')
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .maybeSingle();

  if (error || !data || !data.gyms || !data.profiles) return null;

  return {
    userId: user.id,
    fullName: data.profiles.full_name,
    gymId: data.gym_id,
    gymName: data.gyms.name,
    gymSlug: data.gyms.slug,
    timezone: data.gyms.timezone,
    role: data.role as 'OWNER' | 'STAFF',
  };
}

/** For pages that cannot render at all without a staff session. */
export async function requireStaffSession(): Promise<StaffSession> {
  const session = await getStaffSession();
  if (!session) redirect('/login');
  return session;
}
