// The Razorpay boundary. Nothing outside this file knows the provider's shape,
// and the secret never leaves it.

import { AppError } from './errors.ts';

const API = 'https://api.razorpay.com/v1';

function credentials(): { keyId: string; keySecret: string } {
  const keyId = Deno.env.get('RAZORPAY_KEY_ID');
  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
  if (!keyId || !keySecret) throw new Error('Razorpay credentials are not configured');
  return { keyId, keySecret };
}

/** The publishable half only. Safe to return to a client; the secret is not. */
export function publicKeyId(): string {
  return credentials().keyId;
}

export type RazorpayOrder = { id: string; amount: number; currency: string; receipt: string };

/**
 * Creates the order server-side. The amount comes from the caller, which got it
 * from the plan row — never from a request body (CLAUDE.md rule 2).
 *
 * `receipt` is our own payment id, which is what lets the webhook tie a provider
 * event back to a row without trusting anything in the event's own notes.
 */
export async function createOrder(params: {
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  const { keyId, keySecret } = credentials();

  const response = await fetch(`${API}/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: params.amountPaise, // Razorpay also counts in paise, so no conversion.
      currency: 'INR',
      receipt: params.receipt,
      notes: params.notes ?? {},
      payment_capture: 1,
    }),
  });

  if (!response.ok) {
    // The provider's body can contain account detail; it is logged, not returned.
    console.error(
      JSON.stringify({ scope: 'razorpay.createOrder', status: response.status }),
    );
    throw new AppError('PAYMENT_PROVIDER_ERROR');
  }

  return (await response.json()) as RazorpayOrder;
}

/**
 * Verifies a webhook signature.
 *
 * Two things here are not stylistic. The HMAC is computed over the raw request
 * bytes, before any JSON parsing — parse-then-reserialise produces different
 * bytes and the signature will not match, or worse, will match something other
 * than what was sent. And the comparison is constant-time: a byte-by-byte early
 * return leaks the expected signature to anyone willing to time the responses.
 */
export async function verifyWebhookSignature(rawBody: string, signature: string): Promise<boolean> {
  const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
  if (!secret) throw new Error('RAZORPAY_WEBHOOK_SECRET is not configured');
  if (!signature) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(mac))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  return timingSafeEqual(expected, signature);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
