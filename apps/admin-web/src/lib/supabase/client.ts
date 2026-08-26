'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@gym/types';
import { env } from '../env';

/**
 * Browser client. Carries the anon key and the user's session, so every query it
 * makes is subject to RLS. There is no service-role variant on this side of the
 * app and there never will be (CLAUDE.md rule 3).
 */
export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
