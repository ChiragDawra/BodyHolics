// docs/07 §5 — staff force the gym open or closed for a window (D-007).

import { withRequestId, ok, fail, fieldErrors } from '../_shared/response.ts';
import { requireStaff } from '../_shared/auth.ts';
import { createAdminClient } from '../_shared/db.ts';
import { overrideGymStatusSchema } from '../_shared/schemas/requests.ts';
import { AppError } from '../_shared/errors.ts';

Deno.serve(
  withRequestId(async (req, ctx) => {
    if (req.method !== 'POST') return fail('NOT_FOUND', ctx, req);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail('VALIDATION_FAILED', ctx, req);
    }

    const parsed = overrideGymStatusSchema.safeParse(body);
    if (!parsed.success) {
      // The schema's refines cover the ordering and the 30-day cap, and both map
      // to the same registry code rather than leaking which refine tripped.
      return fail('OVERRIDE_RANGE_INVALID', ctx, req, fieldErrors(parsed.error));
    }

    const auth = await requireStaff(req);
    if (!auth.ok) return fail(auth.code, ctx, req);

    const admin = createAdminClient();

    try {
      const startsAt = parsed.data.startsAt ?? new Date().toISOString();

      const { data: override, error } = await admin
        .from('gym_status_overrides')
        .insert({
          gym_id: auth.gymId, // never from the body
          forced_status: parsed.data.status,
          starts_at: startsAt,
          ends_at: parsed.data.endsAt,
          reason: parsed.data.reason ?? null,
          created_by: auth.userId,
        })
        .select('id, forced_status, starts_at, ends_at, reason')
        .single();

      if (error || !override) throw new AppError('OVERRIDE_RANGE_INVALID');

      await admin.from('audit_logs').insert({
        gym_id: auth.gymId,
        actor_user_id: auth.userId,
        action: 'GYM_STATUS_OVERRIDDEN',
        entity_type: 'gym_status_override',
        entity_id: override.id,
        metadata: {
          forced_status: override.forced_status,
          starts_at: override.starts_at,
          ends_at: override.ends_at,
        },
      });

      // Telling members is opt-in: most overrides are routine, and an alert for
      // every one of them trains people to ignore alerts.
      if (parsed.data.notifyMembers) {
        const { data: members } = await admin
          .from('gym_members')
          .select('user_id')
          .eq('gym_id', auth.gymId)
          .eq('status', 'ACTIVE');

        if (members?.length) {
          await admin.from('notifications').insert(
            members.map((member) => ({
              gym_id: auth.gymId,
              user_id: member.user_id,
              source_type: 'SYSTEM' as const,
              source_id: override.id,
              title: parsed.data.status === 'CLOSED' ? 'The gym is closed' : 'The gym is open',
              body: override.reason ?? 'Opening hours have changed temporarily.',
              category: 'HOLIDAY',
            })),
          );
        }
      }

      return ok(
        {
          overrideId: override.id,
          status: override.forced_status,
          startsAt: override.starts_at,
          endsAt: override.ends_at,
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
