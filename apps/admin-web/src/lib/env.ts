import { z } from 'zod';

/**
 * Only NEXT_PUBLIC_* variables belong here. Anything in this file is inlined
 * into the browser bundle at build time, so a service-role key reaching it is a
 * full compromise of the gym (CLAUDE.md rule 3).
 *
 * The schema is parsed at module load rather than read lazily, so a missing or
 * malformed variable fails the build instead of producing an undefined URL that
 * only shows up as a fetch error in production.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_APP_ENV: z.enum(['local', 'staging', 'production']).default('local'),
  // The domain a bare staff username is completed with at the login form.
  // Publishable: it appears in the login request and in the account's own
  // address. Must match what `scripts/bootstrap-gym.mjs` created the account
  // under, or the owner's username resolves to an address that does not exist.
  NEXT_PUBLIC_ADMIN_USERNAME_DOMAIN: z
    .string()
    .min(3)
    .regex(/^[^@\s]+\.[^@\s]+$/, 'must be a bare domain, without an @')
    .default('staff.bodyholics.app'),
});

// Next replaces these member expressions at build time, so they must be written
// out in full rather than read off a loop over process.env.
const parsed = clientEnvSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  NEXT_PUBLIC_ADMIN_USERNAME_DOMAIN: process.env.NEXT_PUBLIC_ADMIN_USERNAME_DOMAIN,
});

if (!parsed.success) {
  // The message names the variables but never their values: a partially-correct
  // key printed into a build log is still a leaked key.
  const missing = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
  throw new Error(`Invalid or missing environment variables: ${missing}`);
}

export const env = parsed.data;

/** Guards development-only affordances, never a security decision on its own. */
export const isProduction = env.NEXT_PUBLIC_APP_ENV === 'production';
