import { z } from 'zod';

/**
 * docs/04 §4 — staff sign in with email + password. `.strict()` matters even on a
 * two-field form: a `role` riding along in the submitted object should be a
 * rejected request, not a silently ignored one.
 */
export const staffLoginSchema = z
  .object({
    email: z.email().max(254),
    // Length only. Composition rules are the identity provider's business, and
    // restating them here just tells an attacker the shape of the search space.
    password: z.string().min(8).max(200),
  })
  .strict();

export type StaffLoginInput = z.infer<typeof staffLoginSchema>;
