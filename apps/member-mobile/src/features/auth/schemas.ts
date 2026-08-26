import { z } from 'zod';

/**
 * The phone shape mirrors the `phone_e164` check constraint on `profiles`, so a
 * number this accepts is one the database will also accept — a mismatch here
 * turns a typo into a 500 instead of a field error.
 */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9][0-9]{7,14}$/, 'Enter a phone number including the country code.');

export const otpSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{6}$/, 'Enter the 6-digit code.');
