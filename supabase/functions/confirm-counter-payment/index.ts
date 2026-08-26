// docs/07 §5 — a staff member takes cash or UPI at the counter and confirms it
// by scanning the member's QR code.
//
// The QR token *is* the authorization. There is deliberately no `paymentId` in
// the request shape: a raw payment id would let any staff account confirm any
// payment, including one belonging to a member who never came to the counter.
//
// The atomic claim in step 2 is what makes the whole thing safe to retry. The
// token is spent by the same statement that reads it, so two simultaneous scans
// cannot both succeed and a membership can never be extended twice.

import { withRequestId, ok, fail, fieldErrors } from '../_shared/response.ts';
import { requireStaff } from '../_shared/auth.ts';
import { createAdminClient } from '../_shared/db.ts';
import { confirmCounterPaymentSchema } from '../_shared/schemas/requests.ts';
import { idempotencyKeySchema } from '../_shared/schemas/common.ts';
import { AppError } from '../_shared/errors.ts';

/** sha256 hex. Only the hash is ever stored, so a database leak yields no usable token. */
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

    const parsed = confirmCounterPaymentSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_FAILED', ctx, req, fieldErrors(parsed.error));

    const idempotency = idempotencyKeySchema.safeParse(req.headers.get('Idempotency-Key'));
    if (!idempotency.success) {
      return fail('VALIDATION_FAILED', ctx, req, { 'idempotency-key': 'required' });
    }

    const auth = await requireStaff(req);
    if (!auth.ok) return fail(auth.code, ctx, req);

    const admin = createAdminClient();

    try {
      const tokenHash = await hashToken(parsed.data.memberQrToken);

      // Step 2. Claim the token atomically: the filter and the write are one
      // statement, so a concurrent scan sees zero rows rather than a race.
      const { data: claimed } = await admin
        .from('member_qr_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('token_hash', tokenHash)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .select('id, gym_id, user_id, purpose, payment_id')
        .maybeSingle();

      if (!claimed) {
        // Zero rows has three causes and staff need to be told which, so the
        // follow-up read distinguishes them. It reveals nothing an attacker
        // could not determine by trying, and a scanner showing "expired" versus
        // "already used" is the difference between a useful counter and a
        // confusing one.
        const { data: existing } = await admin
          .from('member_qr_tokens')
          .select('used_at, expires_at, gym_id')
          .eq('token_hash', tokenHash)
          .maybeSingle();

        if (!existing) throw new AppError('QR_TOKEN_INVALID');
        // A token from another gym is not described any further.
        if (existing.gym_id !== auth.gymId) throw new AppError('QR_TOKEN_INVALID');
        if (existing.used_at) throw new AppError('QR_TOKEN_ALREADY_USED');
        throw new AppError('QR_TOKEN_EXPIRED');
      }

      // Step 3. The token must belong to the gym the staff member works at.
      if (claimed.gym_id !== auth.gymId) throw new AppError('CROSS_TENANT_ACCESS');
      if (claimed.purpose !== 'COUNTER_PAYMENT' || !claimed.payment_id) {
        throw new AppError('QR_TOKEN_INVALID');
      }

      // Step 4.
      const { data: payment } = await admin
        .from('payments')
        .select('id, gym_id, user_id, membership_id, amount_paise, status')
        .eq('id', claimed.payment_id)
        .maybeSingle();

      if (!payment) throw new AppError('PAYMENT_NOT_FOUND');
      if (payment.gym_id !== auth.gymId) throw new AppError('CROSS_TENANT_ACCESS');
      if (payment.status === 'PAID') throw new AppError('PAYMENT_ALREADY_PROCESSED');
      if (payment.status !== 'PENDING') throw new AppError('PAYMENT_NOT_PENDING');

      // Steps 5 and 6. The amount is already on the row; the request never
      // mentions it (CLAUDE.md rule 2).
      const paidAt = new Date().toISOString();
      const { error: payError } = await admin
        .from('payments')
        .update({
          status: 'PAID',
          paid_at: paidAt,
          method: parsed.data.method,
          provider: 'COUNTER',
          confirmed_by: auth.userId,
        })
        .eq('id', payment.id)
        .eq('status', 'PENDING'); // conditional: loses cleanly against a racing writer

      if (payError) throw new AppError('INTERNAL_ERROR');

      // Step 7.
      const { error: activateError } = await admin.rpc('activate_membership_for_payment', {
        p_payment_id: payment.id,
      });
      if (activateError) throw new AppError('INVALID_MEMBERSHIP_TRANSITION');

      const [{ data: membership }, { data: profile }, { data: gymMember }] = await Promise.all([
        admin
          .from('memberships')
          .select('id, status, start_at, end_at')
          .eq('id', payment.membership_id)
          .single(),
        admin.from('profiles').select('full_name, avatar_path').eq('id', payment.user_id).single(),
        admin
          .from('gym_members')
          .select('member_code')
          .eq('gym_id', auth.gymId)
          .eq('user_id', payment.user_id)
          .single(),
      ]);

      // Step 8.
      await admin.from('audit_logs').insert({
        gym_id: auth.gymId,
        actor_user_id: auth.userId,
        action: 'COUNTER_PAYMENT_CONFIRMED',
        entity_type: 'payment',
        entity_id: payment.id,
        // The raw token is never logged, here or anywhere (docs/04 §13).
        metadata: { method: parsed.data.method, amount_paise: payment.amount_paise },
      });

      let avatarUrl: string | null = null;
      if (profile?.avatar_path) {
        // Private bucket: a signed URL with a short TTL, never a public path.
        const { data: signed } = await admin.storage
          .from('avatars')
          .createSignedUrl(profile.avatar_path, 3600);
        avatarUrl = signed?.signedUrl ?? null;
      }

      return ok(
        {
          payment: {
            id: payment.id,
            amountPaise: payment.amount_paise,
            status: 'PAID' as const,
            paidAt,
          },
          membership: {
            id: membership?.id ?? payment.membership_id,
            status: membership?.status ?? 'ACTIVE',
            startAt: membership?.start_at ?? null,
            endAt: membership?.end_at ?? null,
          },
          member: {
            fullName: profile?.full_name ?? 'Member',
            memberCode: gymMember?.member_code ?? '',
            avatarUrl,
          },
        },
        ctx,
        req,
      );
    } catch (error) {
      if (error instanceof AppError) return fail(error.code, ctx, req);
      console.error(JSON.stringify({ requestId: ctx.requestId, message: String(error) }));
      return fail('INTERNAL_ERROR', ctx, req);
    }
  }),
);
