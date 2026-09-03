/**
 * Shapes shared by the discount form and the action behind it.
 *
 * These live outside `lib/actions/admin.ts` because a `"use server"` module
 * may only export async functions: exporting a plain array from it compiles
 * fine and then fails at runtime with
 * "A 'use server' file can only export async functions, found object."
 */

/**
 * Expiry is chosen from a short list rather than a date picker: the desk is
 * agreeing "20% off for three months", not selecting a calendar day, and a
 * picker invites someone to set an expiry in the past.
 */
export const DISCOUNT_TERMS = ["1m", "3m", "6m", "never"] as const;
export type DiscountTerm = (typeof DISCOUNT_TERMS)[number];

export const DISCOUNT_TERM_MONTHS: Record<Exclude<DiscountTerm, "never">, number> = {
  "1m": 1,
  "3m": 3,
  "6m": 6,
};

/** The agreed steps. Percentage points, and whole rupees. */
export const PERCENT_STEPS = [10, 20, 25, 30, 40] as const;
export const FLAT_STEPS_RUPEES = [100, 200, 300, 400, 500] as const;
