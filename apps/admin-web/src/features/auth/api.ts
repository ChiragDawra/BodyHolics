import { createClient } from '@/lib/supabase/client';
import type { StaffLoginInput } from './schemas';

/**
 * The only place in the admin app that talks to Supabase Auth. `signOut` is here
 * too so that both paths clear the same session in the same way.
 */
export async function signInWithPassword(input: StaffLoginInput) {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword(input);

  if (error) {
    // Deliberately one message for both "no such account" and "wrong password".
    // Distinguishing them turns the login form into an account enumerator.
    throw new Error('Those details did not match an account.');
  }
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
}
