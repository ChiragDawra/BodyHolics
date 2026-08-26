// docs/07 §4 — start a purchase.
//
// The one thing this function must never do is believe the client about money.
// There is no `amountPaise` in the request shape and there never will be: the
// amount is read from `membership_plans.price_paise` and snapshotted onto both
// the membership and the payment (CLAUDE.md rule 2).
//
// Nothing here activates anything. This creates a PENDING_PAYMENT membership and
// a PENDING payment; only a verified webhook or a staff counter-confirmation
// moves either of them (CLAUDE.md rule 1).

import { withRequestId, ok, fail, fieldErrors } from '../_shared/response.ts';
import { requireMember } from '../_shared/auth.ts';
import { rateLimit, retryAfterSeconds } from '../_shared/ratelimit.ts';
import { createAdminClient } from '../_shared/db.ts';
import { createPaymentOrderSchema } from '../_shared/schemas/requests.ts';
import { idempotencyKeySchema } from '../_shared/schemas/common.ts';
import { AppError } from '../_shared/errors.ts';
import { createOrder, publicKeyId } from '../_shared/razorpay.ts';

Deno.serve(
  withRequestId(async (req, ctx) => {
    if (req.method !== 'POST') return fail('NOT_FOUND', ctx, req);

    // Fixed order (docs/06 §6): method -> validate -> authorize -> limit -> work.
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail('VALIDATION_FAILED', ctx, req);
    }

    const parsed = createPaymentOrderSchema.safeParse(body);
    if (!parsed.success) {
      return fail('VALIDATION_FAILED', ctx, req, fieldErrors(parsed.error));
    }

    const idempotency = idempotencyKeySchema.safeParse(req.headers.get('Idempotency-Key'));
    if (!idempotency.success) return fail('VALIDATION_FAILED', ctx, req, { 'idempotency-key': 'required' });

    const auth = await requireMember(req);
    if (!auth.ok) return fail(auth.code, ctx, req);

    if (await rateLimit('create-payment-order', auth.userId)) {
      const response = fail('RATE_LIMITED', ctx, req);
      response.headers.set('Retry-After', String(retryAfterSeconds('create-payment-order')));
      return response;
    }

    const admin = createAdminClient();

    try {
      // Replaying the same key returns the original result rather than opening a
      // second order. A member double-tapping "Pay" must not buy twice.
      const { data: existing } = await admin
        .from('payments')
        .select('id, membership_id, amount_paise, method, provider_order_id')
        .eq('idempotency_key', idempotency.data)
        .maybeSingle();

      if (existing) {
        return ok(
          {
            paymentId: existing.id,
            membershipId: existing.membership_id,
            amountPaise: existing.amount_paise,
            currency: 'INR' as const,
            method: existing.method,
            ...(existing.provider_order_id
              ? {
                  razorpay: {
                    orderId: existing.provider_order_id,
                    keyId: publicKeyId(),
                    checkoutUrl: 'https://checkout.razorpay.com/v1/checkout.js',
                  },
                }
              : {}),
          },
          ctx,
          req,
        );
      }

      // The plan must belong to the caller's own gym. Without this check a member
      // could buy another gym's plan by id and land a membership at their own.
      const { data: plan } = await admin
        .from('membership_plans')
        .select('id, gym_id, price_paise, duration_days, is_active')
        .eq('id', parsed.data.planId)
        .maybeSingle();

      if (!plan || plan.gym_id !== auth.gymId) throw new AppError('PLAN_NOT_FOUND');
      if (!plan.is_active) throw new AppError('PLAN_INACTIVE');

      // D-004: one pending membership per member per gym. There is also a partial
      // unique index enforcing this, so a race loses at the database rather than
      // producing two.
      const { data: pending } = await admin
        .from('memberships')
        .select('id')
        .eq('gym_id', auth.gymId)
        .eq('user_id', auth.userId)
        .eq('status', 'PENDING_PAYMENT')
        .maybeSingle();

      if (pending) throw new AppError('MEMBERSHIP_ALREADY_PENDING');

      const { data: membership, error: membershipError } = await admin
        .from('memberships')
        .insert({
          gym_id: auth.gymId,
          user_id: auth.userId,
          plan_id: plan.id,
          status: 'PENDING_PAYMENT',
          price_paise: plan.price_paise, // snapshot, so history survives a reprice
        })
        .select('id')
        .single();

      if (membershipError || !membership) {
        // The partial unique index fires here if two requests raced.
        if (membershipError?.code === '23505') throw new AppError('MEMBERSHIP_ALREADY_PENDING');
        throw new AppError('INTERNAL_ERROR');
      }

      const { data: payment, error: paymentError } = await admin
        .from('payments')
        .insert({
          gym_id: auth.gymId,
          user_id: auth.userId,
          membership_id: membership.id,
          amount_paise: plan.price_paise, // from the plan row, never from the body
          method: parsed.data.method,
          status: 'PENDING',
          provider: parsed.data.method === 'ONLINE' ? 'RAZORPAY' : 'COUNTER',
          idempotency_key: idempotency.data,
        })
        .select('id')
        .single();

      if (paymentError || !payment) throw new AppError('INTERNAL_ERROR');

      if (parsed.data.method !== 'ONLINE') {
        return ok(
          {
            paymentId: payment.id,
            membershipId: membership.id,
            amountPaise: plan.price_paise,
            currency: 'INR' as const,
            method: parsed.data.method,
          },
          ctx,
          req,
          201,
        );
      }

      let order;
      try {
        order = await createOrder({
          amountPaise: plan.price_paise,
          receipt: payment.id,
          notes: { gym_id: auth.gymId, membership_id: membership.id },
        });
      } catch (error) {
        // The provider call is outside the database transaction, so a failure
        // here leaves rows behind. Cancel them rather than leaving a phantom
        // pending membership that blocks the member's next attempt.
        await admin.from('payments').update({ status: 'CANCELLED' }).eq('id', payment.id);
        await admin
          .from('memberships')
          .update({ status: 'CANCELLED', cancelled_at: new Date().toISOString() })
          .eq('id', membership.id);
        throw error;
      }

      await admin
        .from('payments')
        .update({ provider_order_id: order.id })
        .eq('id', payment.id);

      return ok(
        {
          paymentId: payment.id,
          membershipId: membership.id,
          amountPaise: plan.price_paise,
          currency: 'INR' as const,
          method: parsed.data.method,
          razorpay: {
            orderId: order.id,
            // The publishable key id. The secret stays on the server.
            keyId: publicKeyId(),
            checkoutUrl: 'https://checkout.razorpay.com/v1/checkout.js',
          },
        },
        ctx,
        req,
        201,
      );
    } catch (error) {
      if (error instanceof AppError) return fail(error.code, ctx, req);
      console.error(JSON.stringify({ requestId: ctx.requestId, message: String(error) }));
      return fail('INTERNAL_ERROR', ctx, req);
    }
  }),
);
