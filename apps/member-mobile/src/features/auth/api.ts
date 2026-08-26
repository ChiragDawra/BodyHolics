import { functionsUrl, supabase } from '@/lib/supabase';
import { invokeFunction } from '@/lib/functions';

/**
 * docs/04 §3 — phone OTP only. Never write a custom OTP generator and never
 * store an OTP anywhere: Supabase Auth owns that entirely.
 *
 * The phone is the identity. It goes to the auth server here and is read back
 * from the JWT on the server side; no endpoint in this app accepts a phone in a
 * request body, because a body-supplied number is a claim, not a fact.
 */

export async function requestOtp(phone: string) {
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) {
    // Deliberately not distinguishing "no such number" from anything else:
    // that difference turns this screen into a way to test which numbers are
    // registered.
    throw new Error('We could not send a code. Please check the number and try again.');
  }
}

export async function verifyOtp(phone: string, token: string) {
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
  if (error) throw new Error('That code is not right, or it has expired.');
}

export type GymPublic = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  timezone: string;
  isActive: boolean;
};

/** Public — this runs before the member has an account (D-006). */
export async function fetchGymBySlug(slug: string): Promise<GymPublic> {
  const response = await fetch(`${functionsUrl}/gym-by-slug?slug=${encodeURIComponent(slug)}`);
  const body = (await response.json()) as
    | { data: GymPublic }
    | { error: { code: string; message: string } };

  // The registry wording, not whatever came back on the wire.
  if ('error' in body) throw new Error('We could not find that gym. Check the QR code.');
  return body.data;
}

export type CreateProfileResult = {
  profile: { id: string; fullName: string; phone: string; avatarUrl: string | null };
  member: { gymId: string; memberCode: string; joinedAt: string };
};

export function createMemberProfile(input: {
  gymSlug: string;
  fullName: string;
  // `| undefined` is required under exactOptionalPropertyTypes: the zod output
  // type includes it, and dropping it here would force every caller to strip
  // the key rather than pass it through.
  dateOfBirth?: string | undefined;
}) {
  return invokeFunction<CreateProfileResult>('create-member-profile', input);
}
