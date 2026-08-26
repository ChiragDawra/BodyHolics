// docs/07 §8 — a member records their own presence (D-008).
//
// Two things are forced server-side and cannot be influenced by the caller:
// `user_id` is the JWT's subject, and `source_type` is MANUAL. CHECK_IN and
// CHECK_OUT, and the QR/FINGERPRINT sources, are service-key only and have no
// user-facing endpoint at all — which is why `attendanceEventSchema` accepts
// only the two PRESENCE_* values.

import { withRequestId, ok, fail, fieldErrors } from '../_shared/response.ts';
import { requireMember } from '../_shared/auth.ts';
import { rateLimit, retryAfterSeconds } from '../_shared/ratelimit.ts';
import { createAdminClient } from '../_shared/db.ts';
import { attendanceEventSchema } from '../_shared/schemas/requests.ts';

Deno.serve(
  withRequestId(async (req, ctx) => {
    if (req.method !== 'POST') return fail('NOT_FOUND', ctx, req);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail('VALIDATION_FAILED', ctx, req);
    }

    const parsed = attendanceEventSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_FAILED', ctx, req, fieldErrors(parsed.error));

    const auth = await requireMember(req);
    if (!auth.ok) return fail(auth.code, ctx, req);

    if (await rateLimit('attendance-event', auth.userId)) {
      const response = fail('RATE_LIMITED', ctx, req);
      response.headers.set('Retry-After', String(retryAfterSeconds('attendance-event')));
      return response;
    }

    const admin = createAdminClient();
    const { eventType } = parsed.data;

    // The open presence, if there is one. `metadata->>'closed' is null` is the
    // same condition as the partial unique index, so this read and that
    // constraint agree by construction.
    const { data: open } = await admin
      .from('attendance_events')
      .select('id, occurred_at')
      .eq('gym_id', auth.gymId)
      .eq('user_id', auth.userId)
      .eq('event_type', 'PRESENCE_START')
      .is('metadata->>closed', null)
      .maybeSingle();

    if (eventType === 'PRESENCE_START') {
      // Already inside: a no-op, not an error. A phone that retries a failed
      // request must not be told it is doing something wrong.
      if (open) return ok({ eventType, occurredAt: open.occurred_at, noop: true }, ctx, req);

      const occurredAt = new Date().toISOString();
      const { error } = await admin.from('attendance_events').insert({
        gym_id: auth.gymId,
        user_id: auth.userId,
        source_type: 'MANUAL', // forced; never from the body
        event_type: 'PRESENCE_START',
        occurred_at: occurredAt,
      });

      if (error) return fail('INTERNAL_ERROR', ctx, req);
      return ok({ eventType, occurredAt, noop: false }, ctx, req, 201);
    }

    // PRESENCE_END with nothing open is also a no-op.
    if (!open) return ok({ eventType, occurredAt: null, noop: true }, ctx, req);

    const occurredAt = new Date().toISOString();
    const { error } = await admin.from('attendance_events').insert({
      gym_id: auth.gymId,
      user_id: auth.userId,
      source_type: 'MANUAL',
      event_type: 'PRESENCE_END',
      occurred_at: occurredAt,
    });

    if (error) return fail('INTERNAL_ERROR', ctx, req);

    // Close the open start so the partial unique index frees up for the next
    // visit. This is the flag the index keys on.
    await admin
      .from('attendance_events')
      .update({ metadata: { closed: true } })
      .eq('id', open.id);

    return ok({ eventType, occurredAt, noop: false }, ctx, req, 201);
  }),
);
