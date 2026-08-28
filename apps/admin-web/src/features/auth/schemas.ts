import { z } from 'zod';
import { env } from '@/lib/env';

/**
 * docs/04 §4 — staff sign in with email + password.
 *
 * The field is an *identifier* rather than an email because the owner signs in
 * with a bare username. Supabase Auth has no username concept: every password
 * account is keyed by an email address, so a username has to resolve to one
 * before the request leaves the browser. `resolveLoginEmail` is that mapping and
 * the only place it happens — see D-022.
 *
 * `.strict()` matters even on a two-field form: a `role` riding along in the
 * submitted object should be a rejected request, not a silently ignored one.
 */
export const staffLoginSchema = z
  .object({
    identifier: z.string().trim().min(1).max(254),
    // Length only. Composition rules are the identity provider's business, and
    // restating them here just tells an attacker the shape of the search space.
    password: z.string().min(8).max(200),
  })
  .strict();

export type StaffLoginInput = z.infer<typeof staffLoginSchema>;

/**
 * `ChiragDawra` → `chiragdawra@staff.bodyholics.app`; an address typed in full is
 * passed through unchanged.
 *
 * Lower-casing is what makes the username case-insensitive at the form, which is
 * the whole point of accepting one. It has to happen here rather than in the
 * database, because Supabase compares the address it is given.
 */
export function resolveLoginEmail(identifier: string): string {
  const trimmed = identifier.trim();
  return trimmed.includes('@')
    ? trimmed
    : `${trimmed.toLowerCase()}@${env.NEXT_PUBLIC_ADMIN_USERNAME_DOMAIN}`;
}
