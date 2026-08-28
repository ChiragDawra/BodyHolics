import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { anonKey, functionsUrl, supabase } from '@/lib/supabase';
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
  // No user session yet — this runs before the member has an account. The anon
  // key is still required: hosted Edge Functions reject an unauthenticated
  // request before the handler runs, and the local stack is more permissive.
  const response = await fetch(`${functionsUrl}/gym-by-slug?slug=${encodeURIComponent(slug)}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  const body = (await response.json()) as
    | { data: GymPublic }
    | { error: { code: string; message: string } };

  // The registry wording, not whatever came back on the wire.
  if ('error' in body) throw new Error('We could not find that gym. Check the QR code.');
  return body.data;
}

/**
 * Google sign-in (D-021).
 *
 * Phone OTP is still the intended launch path; this exists because Indian SMS
 * needs DLT registration against the gym owner's business documents, which
 * cannot happen before the owner has seen the app work. Both providers end up
 * writing the same thing: a verified identity, read from the JWT server-side.
 *
 * The flow deliberately does not use an embedded WebView. `openAuthSessionAsync`
 * hands off to the system browser (SFAuthenticationSession / Custom Tabs), so
 * the app never sees the Google password field — and Google refuses embedded
 * webviews for exactly that reason.
 */
export async function signInWithGoogle(): Promise<void> {
  const redirectTo = Linking.createURL('auth-callback');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      // The app completes the exchange itself, below.
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) throw new Error('Could not start Google sign-in.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type !== 'success') {
    // Cancelling is not an error worth shouting about — the member just closed
    // the sheet.
    throw new Error('SIGN_IN_CANCELLED');
  }

  // Supabase returns the tokens in the URL fragment. Parse them here rather than
  // letting the client sniff the URL: `detectSessionInUrl` is off precisely so a
  // link someone else sent cannot install a session.
  const fragment = result.url.split('#')[1] ?? '';
  const params = new URLSearchParams(fragment);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');

  if (!access_token || !refresh_token) {
    throw new Error('Google sign-in did not complete. Please try again.');
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });

  if (sessionError) throw new Error('Google sign-in did not complete. Please try again.');
}

export type CreateProfileResult = {
  profile: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
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
