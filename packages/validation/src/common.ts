// Shared primitives. Every Edge Function body is parsed with one of these
// schemas before anything else happens (docs/06 §6, step 2 of the fixed order).
import { z } from 'zod';

export const uuidSchema = z.uuid();

/** `gyms.slug` — appears in a QR payload and a join URL, so keep it URL-safe. */
export const gymSlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens.');

/** C0 and C1 control characters, which no user-entered field ever needs. */
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/;

/**
 * Free text a member types. Trimmed, length-bounded, and stripped of control
 * characters so a stored value cannot smuggle terminal escapes into an admin
 * console or line breaks into a CSV export.
 */
export function safeText(min: number, max: number) {
  return z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((value) => !CONTROL_CHARS.test(value), {
      message: 'Contains characters that are not allowed.',
    });
}

/**
 * A CSV cell starting with one of these is executed as a formula by Excel and
 * Sheets. The admin payment export is attacker-influenced (member names), so
 * any field that can reach a CSV is checked here.
 */
export const noFormulaPrefix = (value: string): boolean => !/^[=+\-@\t\r]/.test(value);

/**
 * `Date.parse` is not a calendar check - it rolls 1994-02-30 over to March 2 and
 * reports success. Postgres `date` does not, so an unchecked value here becomes
 * a raw DB error instead of a clean 400. Round-trip the parts to be sure.
 */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number) as [number, number, number];
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    );
  }, 'Not a real date');

export const isoDateTimeSchema = z.iso.datetime({ offset: true });

/** `HH:MM` in gym-local time, as stored in `gym_hours`. */
export const localTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM');

/** 0 = Sunday .. 6 = Saturday, matching Postgres `extract(dow)`. */
export const weekdaySchema = z.int().min(0).max(6);

/** Required on create-payment-order and confirm-counter-payment (docs/07 §1). */
export const idempotencyKeySchema = z.uuid();
