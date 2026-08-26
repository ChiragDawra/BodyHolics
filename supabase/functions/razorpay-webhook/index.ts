// docs/07 §5 — the only unauthenticated endpoint in the system, and the one
// that turns money into access. Everything below follows from two facts:
//
//   1. Anyone on the internet can POST here. The HMAC signature is the *only*
//      authentication, so nothing touches the database before it verifies.
//   2. Razorpay retries on any non-2xx. A handler that errors on a duplicate
//      turns one event into an infinite retry loop, so a replay must be a
//      no-op that returns 200, not an error (CLAUDE.md rule 11).
//
// Note there is no `verify_jwt` here: this function is deployed with
// `--no-verify-jwt`, which is why the signature check is not optional.

import { withRequestId, ok, fail } from '../_shared/response.ts';
import { createAdminClient } from '../_shared/db.ts';
import { verifyWebhookSignature } from '../_shared/razorpay.ts';

type RazorpayEvent = {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; amount?: number; method?: string; error_description?: string } };
    refund?: { entity?: { id?: string; payment_id?: string; amount?: number } };
  };
};

const HANDLED = new Set([
  'payment.authorized',
  'payment.captured',
  'payment.failed',
  'refund.processed',
]);

Deno.serve(
  withRequestId(async (req, ctx) => {
    if (req.method !== 'POST') return fail('NOT_FOUND', ctx, req);

    // Step 1. Raw bytes, before any parsing. Parsing and re-serialising produces
    // different bytes and the HMAC will not match — intermittently, which is the
    // worst way for this to fail.
    const rawBody = await req.text();
    const signature = req.headers.get('X-Razorpay-Signature') ?? '';

    // Step 2. Constant-time compare inside verifyWebhookSignature.
    let valid = false;
    try {
      valid = await verifyWebhookSignature(rawBody, signature);
    } catch (error) {
      console.error(JSON.stringify({ requestId: ctx.requestId, message: String(error) }));
      return fail('INTERNAL_ERROR', ctx, req);
    }

    if (!valid) {
      // Logged without the signature or the body: both are attacker-controlled
      // and the body may carry payment detail.
      console.warn(JSON.stringify({ requestId: ctx.requestId, event: 'webhook_signature_invalid' }));
      return fail('WEBHOOK_SIGNATURE_INVALID', ctx, req);
    }

    let event: RazorpayEvent;
    try {
      event = JSON.parse(rawBody) as RazorpayEvent;
    } catch {
      // Signed but unparseable. Returning 400 would make Razorpay retry forever.
      console.warn(JSON.stringify({ requestId: ctx.requestId, event: 'webhook_unparseable' }));
      return ok({ received: true }, ctx, req);
    }

    const eventName = event.event ?? '';

    // Step 3. An unhandled event is not an error — 200 so it is not retried.
    if (!HANDLED.has(eventName)) {
      return ok({ received: true, handled: false }, ctx, req);
    }

    const admin = createAdminClient();
    const eventId = req.headers.get('X-Razorpay-Event-Id') ?? null;

    try {
      if (eventName === 'refund.processed') {
        await handleRefund(admin, event, eventId, ctx.requestId);
        return ok({ received: true, handled: true }, ctx, req);
      }

      const entity = event.payload?.payment?.entity;
      const orderId = entity?.order_id;
      const paymentId = entity?.id;

      if (!orderId) return ok({ received: true, handled: false }, ctx, req);

      // Step 4. Not found is a 200: the order may belong to another environment
      // pointed at the same webhook URL, and retrying will never help.
      const { data: payment } = await admin
        .from('payments')
        .select('id, gym_id, status, amount_paise, metadata')
        .eq('provider_order_id', orderId)
        .maybeSingle();

      if (!payment) {
        console.warn(JSON.stringify({ requestId: ctx.requestId, event: 'webhook_order_unknown' }));
        return ok({ received: true, handled: false }, ctx, req);
      }

      // Duplicate delivery. Razorpay retries, and the same event arriving twice
      // must not activate twice or write a second audit row.
      const seen = readEventIds(payment.metadata);
      if (eventId && seen.includes(eventId)) {
        return ok({ received: true, handled: true, duplicate: true }, ctx, req);
      }

      // Step 5. The amount is checked against our own row, not trusted. A
      // mismatch is recorded and does *not* activate anything — this is the
      // control that stops a tampered or misrouted event buying a membership.
      if (typeof entity?.amount === 'number' && entity.amount !== payment.amount_paise) {
        await admin.from('audit_logs').insert({
          gym_id: payment.gym_id,
          action: 'PAYMENT_AMOUNT_MISMATCH',
          entity_type: 'payment',
          entity_id: payment.id,
          metadata: {
            expected_paise: payment.amount_paise,
            received_paise: entity.amount,
            event: eventName,
          },
        });
        console.warn(JSON.stringify({ requestId: ctx.requestId, event: 'webhook_amount_mismatch' }));
        return ok({ received: true, handled: false, reason: 'amount_mismatch' }, ctx, req);
      }

      // Step 6. Already in the target state is a no-op, not an error.
      if (eventName === 'payment.failed') {
        if (payment.status !== 'PENDING' && payment.status !== 'AUTHORIZED') {
          return ok({ received: true, handled: true, noop: true }, ctx, req);
        }
        await admin
          .from('payments')
          .update({
            status: 'FAILED',
            // A provider description is not a user-facing message, but it is
            // useful to staff. It is stored, never returned by this endpoint.
            failure_reason: entity?.error_description ?? 'Payment failed at the provider.',
            provider_payment_id: paymentId ?? null,
            metadata: withEventId(payment.metadata, eventId, entity?.method),
          })
          .eq('id', payment.id);

        return ok({ received: true, handled: true }, ctx, req);
      }

      if (payment.status === 'PAID') {
        return ok({ received: true, handled: true, noop: true }, ctx, req);
      }

      if (eventName === 'payment.authorized') {
        // Authorized is not captured. Access is granted on capture only.
        if (payment.status === 'PENDING') {
          await admin
            .from('payments')
            .update({
              status: 'AUTHORIZED',
              provider_payment_id: paymentId ?? null,
              metadata: withEventId(payment.metadata, eventId, entity?.method),
            })
            .eq('id', payment.id);
        }
        return ok({ received: true, handled: true }, ctx, req);
      }

      // payment.captured — the money is actually ours.
      const { error: updateError } = await admin
        .from('payments')
        .update({
          status: 'PAID',
          paid_at: new Date().toISOString(),
          provider_payment_id: paymentId ?? null,
          metadata: withEventId(payment.metadata, eventId, entity?.method),
        })
        .eq('id', payment.id);

      if (updateError) throw updateError;

      // Step 7. Activation is a database function so the membership update, the
      // audit row and the member's notification are one transaction, and so the
      // period-stacking rule (D-004) has exactly one implementation.
      const { error: activateError } = await admin.rpc('activate_membership_for_payment', {
        p_payment_id: payment.id,
      });

      if (activateError) {
        // The payment is genuinely PAID; only activation failed. Record it and
        // still return 200 — a retry would re-run a capture that already
        // succeeded. This needs a human, so it goes in the audit log.
        await admin.from('audit_logs').insert({
          gym_id: payment.gym_id,
          action: 'MEMBERSHIP_ACTIVATION_FAILED',
          entity_type: 'payment',
          entity_id: payment.id,
          metadata: { reason: activateError.message },
        });
        console.error(
          JSON.stringify({ requestId: ctx.requestId, event: 'activation_failed', paymentId: payment.id }),
        );
      }

      return ok({ received: true, handled: true }, ctx, req);
    } catch (error) {
      // Even here, 200. An exception in our code is our problem to fix from the
      // logs; making Razorpay retry it every few minutes does not help.
      console.error(JSON.stringify({ requestId: ctx.requestId, message: String(error) }));
      return ok({ received: true, handled: false }, ctx, req);
    }
  }),
);

/** docs/05 §3 — metadata may hold the event id and a method label. Nothing else. */
function readEventIds(metadata: unknown): string[] {
  if (typeof metadata !== 'object' || metadata === null) return [];
  const ids = (metadata as { eventIds?: unknown }).eventIds;
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
}

function withEventId(metadata: unknown, eventId: string | null, method?: string) {
  const base = typeof metadata === 'object' && metadata !== null ? { ...metadata } : {};
  const ids = readEventIds(metadata);
  return {
    ...base,
    // Bounded: a payment that somehow accumulates events must not grow a row
    // without limit.
    eventIds: eventId ? [...new Set([...ids, eventId])].slice(-20) : ids,
    // Never a VPA, a card number, or anything else identifying — just the label.
    ...(method ? { method } : {}),
  };
}

async function handleRefund(
  admin: ReturnType<typeof createAdminClient>,
  event: RazorpayEvent,
  eventId: string | null,
  requestId: string,
) {
  const refund = event.payload?.refund?.entity;
  if (!refund?.payment_id) return;

  const { data: payment } = await admin
    .from('payments')
    .select('id, gym_id, status, metadata')
    .eq('provider_payment_id', refund.payment_id)
    .maybeSingle();

  if (!payment) {
    console.warn(JSON.stringify({ requestId, event: 'webhook_refund_unknown' }));
    return;
  }

  if (payment.status === 'REFUNDED') return; // replay

  await admin
    .from('payments')
    .update({ status: 'REFUNDED', metadata: withEventId(payment.metadata, eventId) })
    .eq('id', payment.id);

  // A refund reduces reported revenue and is OWNER-visible (docs/04 §9), so it
  // is audited. The membership is deliberately left alone: whether a refund also
  // revokes access is a business decision, not a webhook's to make.
  await admin.from('audit_logs').insert({
    gym_id: payment.gym_id,
    action: 'PAYMENT_REFUNDED',
    entity_type: 'payment',
    entity_id: payment.id,
    metadata: { amount_paise: refund.amount ?? null },
  });
}
