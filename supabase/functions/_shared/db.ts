// The only place a service-role client is constructed. This file exists under
// supabase/functions/ and must never be imported from apps/* (CLAUDE.md rule 3).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Bypasses RLS entirely. Every caller must have already established who the
 * user is and what they may do — this client will happily read any gym's rows.
 */
export function createAdminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * A client carrying the caller's own JWT, so RLS applies exactly as it would to
 * a direct query. Used where a function only needs to act *as* the user.
 */
export function createUserClient(accessToken: string): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anon) throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required');

  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
