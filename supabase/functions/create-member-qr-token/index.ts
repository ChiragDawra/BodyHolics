// docs/07 §5 — mint the short-lived token behind the QR code a member shows at
// the counter.
//
// The token is a bearer credential: whoever holds it can have a counter payment
// confirmed against it. Three things follow, and none is optional.
//
//   * 32 bytes from a CSPRNG, not a uuid and not a counter.
//   * Only the sha256 hash is stored, so a database leak yields nothing usable.
//   * A short TTL, and the previous unused token for the same purpose is
//     invalidated — a screenshot from yesterday must not still work.
//
// The raw token is returned exactly once, in this response, and is never logged.

import { withRequestId, ok, fail, fieldErrors } from '../_shared/response.ts';
import { requireMember } from '../_shared/auth.ts';
import { rateLimit, retryAfterSeconds } from '../_shared/ratelimit.ts';
import { createAdminClient } from '../_shared/db.ts';
import { createQrTokenSchema } from '../_shared/schemas/requests.ts';
import { AppError } from '../_shared/errors.ts';

const TTL_SECONDS = { COUNTER_PAYMENT: 120, MEMBER_LOOKUP: 300 } as const;

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  // base64url: safe inside a QR payload without further escaping.
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function hashToken(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(
  withRequestId(async (req, ctx) => {
    if (req.method !== 'POST') return fail('NOT_FOUND', ctx, req);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail('VALIDATION_FAILED', ctx, req);
    }

    const parsed = createQrTokenSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_FAILED', ctx, req, fieldErrors(parsed.error));

    const auth = await requireMember(req);
    if (!auth.ok) return fail(auth.code, ctx, req);

    if (await rateLimit('create-member-qr-token', auth.userId)) {
      const response = fail('RATE_LIMITED', ctx, req);
      response.headers.set('Retry-After', String(retryAfterSeconds('create-member-qr-token')));
      return response;
    }

    const admin = createAdminClient();

    try {
      const { purpose } = parsed.data;

      if (purpose === 'COUNTER_PAYMENT') {
        // The payment must be the caller's own, at their own gym, and still
        // awaiting money. Without the ownership check a member could mint a
        // token against someone else's pending payment and have it settled.
        const { data: payment } = await admin
          .from('payments')
          .select('id, user_id, gym_id, status')
          .eq('id', parsed.data.paymentId)
          .maybeSingle();

        if (!payment || payment.user_id !== auth.userId) throw new AppError('PAYMENT_NOT_FOUND');
        if (payment.gym_id !== auth.gymId) throw new AppError('CROSS_TENANT_ACCESS');
        if (payment.status !== 'PENDING') throw new AppError('PAYMENT_NOT_PENDING');
      }

      // Invalidate the caller's previous unused token for this purpose, so only
      // the newest QR on screen is live.
      await admin
        .from('member_qr_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('user_id', auth.userId)
        .eq('gym_id', auth.gymId)
        .eq('purpose', purpose)
        .is('used_at', null);

      const raw = randomToken();
      const ttlSeconds = TTL_SECONDS[purpose];
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

      const { error } = await admin.from('member_qr_tokens').insert({
        gym_id: auth.gymId,
        user_id: auth.userId,
        purpose,
        payment_id: purpose === 'COUNTER_PAYMENT' ? parsed.data.paymentId : null,
        token_hash: await hashToken(raw),
        expires_at: expiresAt,
      });

      if (error) throw new AppError('INTERNAL_ERROR');

      // The only time the raw token exists outside the member's device.
      return ok({ token: raw, expiresAt, ttlSeconds }, ctx, req, 201);
    } catch (error) {
      if (error instanceof AppError) return fail(error.code, ctx, req);
      // String(error) cannot contain the token: it is never interpolated into
      // any message, and the insert stores only the hash.
      console.error(JSON.stringify({ requestId: ctx.requestId, message: String(error) }));
      return fail('INTERNAL_ERROR', ctx, req);
    }
  }),
);
