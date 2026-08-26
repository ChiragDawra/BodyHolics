// docs/07 §4 — what the checkout screen polls while a payment settles.
//
// It reports; it never decides. The status it returns is whatever the webhook or
// a counter confirmation already wrote. A client polling this cannot cause an
// activation, which is the point of it being a separate read (CLAUDE.md rule 1).

import { withRequestId, ok, fail } from '../_shared/response.ts';
import { requireUser } from '../_shared/auth.ts';
import { createAdminClient } from '../_shared/db.ts';
import { uuidSchema } from '../_shared/schemas/common.ts';

Deno.serve(
  withRequestId(async (req, ctx) => {
    if (req.method !== 'GET') return fail('NOT_FOUND', ctx, req);

    const paymentId = uuidSchema.safeParse(new URL(req.url).searchParams.get('paymentId'));
    if (!paymentId.success) return fail('VALIDATION_FAILED', ctx, req);

    const user = await requireUser(req);
    if (!user.ok) return fail(user.code, ctx, req);

    const admin = createAdminClient();
    const { data: payment } = await admin
      .from('payments')
      .select('id, user_id, status, amount_paise, paid_at, membership_id, failure_reason')
      .eq('id', paymentId.data)
      .maybeSingle();

    // Someone else's payment is a 404, not a 403: a 403 would confirm the id is
    // real, which is a working oracle for enumerating payment ids.
    if (!payment || payment.user_id !== user.userId) return fail('NOT_FOUND', ctx, req);

    const { data: membership } = await admin
      .from('memberships')
      .select('id, status, start_at, end_at')
      .eq('id', payment.membership_id)
      .maybeSingle();

    return ok(
      {
        paymentId: payment.id,
        status: payment.status,
        amountPaise: payment.amount_paise,
        paidAt: payment.paid_at,
        // A provider description can name an issuer or a bank; the member gets
        // the registry wording instead, which the client already has.
        failed: payment.status === 'FAILED',
        membership: membership
          ? {
              id: membership.id,
              status: membership.status,
              startAt: membership.start_at,
              endAt: membership.end_at,
            }
          : null,
      },
      ctx,
      req,
    );
  }),
);
