import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@gym/types';
import { env } from '../env';

/**
 * Server client for Server Components, Route Handlers and Server Actions. Still
 * the anon key: the admin app never holds elevated credentials, it just runs the
 * user's own session on the server so RLS applies identically in both places.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only. The
            // proxy refreshes the session on every request, so nothing is lost.
          }
        },
      },
    },
  );
}
