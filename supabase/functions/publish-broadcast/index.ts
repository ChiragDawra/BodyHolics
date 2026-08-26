// docs/07 §6 — send an announcement, or schedule one.
//
// The audience is a *rule*, not a list. The client picks ALL_MEMBERS or
// EXPIRING_MEMBERS and the server resolves who that is, at publish time, from
// live membership data. A client-supplied recipient list would let staff mail
// arbitrary user ids, so the only type carrying ids is SELECTED_MEMBERS and
// every one of those is verified to belong to this gym.
//
// Resolution and the recipients/notifications write are both in Postgres
// (`publish_broadcast`), so they happen in one transaction and the audience
// rules have exactly one implementation, shared with the pg_cron path.

import { withRequestId, ok, fail, fieldErrors } from '../_shared/response.ts';
import { requireStaff } from '../_shared/auth.ts';
import { rateLimit, retryAfterSeconds } from '../_shared/ratelimit.ts';
import { createAdminClient } from '../_shared/db.ts';
import { publishBroadcastSchema } from '../_shared/schemas/requests.ts';
import { AppError } from '../_shared/errors.ts';

/** Postgres raises these as messages; map them back to registry codes. */
function mapDatabaseError(message: string): AppError {
  if (message.includes('BROADCAST_EMPTY_AUDIENCE')) return new AppError('BROADCAST_EMPTY_AUDIENCE');
  if (message.includes('CROSS_TENANT_ACCESS')) return new AppError('CROSS_TENANT_ACCESS');
  if (message.includes('BROADCAST_IMMUTABLE')) return new AppError('BROADCAST_IMMUTABLE');
  if (message.includes('INVALID_BROADCAST_TRANSITION')) return new AppError('BROADCAST_IMMUTABLE');
  if (message.includes('VALIDATION_FAILED')) return new AppError('VALIDATION_FAILED');
  return new AppError('INTERNAL_ERROR');
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

    const parsed = publishBroadcastSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_FAILED', ctx, req, fieldErrors(parsed.error));

    const auth = await requireStaff(req);
    if (!auth.ok) return fail(auth.code, ctx, req);

    // Limited per gym rather than per user: the thing being protected is the
    // members' inboxes, and two staff accounts share one set of members.
    if (await rateLimit('publish-broadcast', auth.gymId)) {
      const response = fail('RATE_LIMITED', ctx, req);
      response.headers.set('Retry-After', String(retryAfterSeconds('publish-broadcast')));
      return response;
    }

    const admin = createAdminClient();

    try {
      let broadcastId = parsed.data.broadcastId;

      if (broadcastId) {
        // Publishing an existing draft: it must be one of ours.
        const { data: existing } = await admin
          .from('broadcasts')
          .select('id, gym_id, status')
          .eq('id', broadcastId)
          .maybeSingle();

        if (!existing || existing.gym_id !== auth.gymId) throw new AppError('NOT_FOUND');
        if (existing.status === 'PUBLISHED') throw new AppError('BROADCAST_IMMUTABLE');
      } else {
        // Create-and-publish in one call. The schema's refine has already
        // established that title, body, category and audience are all present.
        const scheduled = parsed.data.publishAt
          ? Date.parse(parsed.data.publishAt) > Date.now()
          : false;

        const { data: created, error } = await admin
          .from('broadcasts')
          .insert({
            gym_id: auth.gymId,
            created_by: auth.userId,
            title: parsed.data.title!,
            body: parsed.data.body!,
            category: parsed.data.category!,
            audience: parsed.data.audience!,
            status: scheduled ? 'SCHEDULED' : 'DRAFT',
            publish_at: scheduled ? parsed.data.publishAt : null,
            // recipient_count is server-computed at publish time; the request
            // shape has no field for it.
          })
          .select('id')
          .single();

        if (error || !created) throw new AppError('INTERNAL_ERROR');
        broadcastId = created.id;

        if (scheduled) {
          await admin.from('audit_logs').insert({
            gym_id: auth.gymId,
            actor_user_id: auth.userId,
            action: 'BROADCAST_SCHEDULED',
            entity_type: 'broadcast',
            entity_id: broadcastId,
            metadata: { publish_at: parsed.data.publishAt },
          });

          return ok(
            {
              broadcastId,
              status: 'SCHEDULED' as const,
              recipientCount: 0,
              publishedAt: null,
            },
            ctx,
            req,
            201,
          );
        }
      }

      const { data: published, error: publishError } = await admin.rpc('publish_broadcast', {
        p_broadcast_id: broadcastId,
      });

      if (publishError) throw mapDatabaseError(publishError.message);

      const row = Array.isArray(published) ? published[0] : published;

      return ok(
        {
          broadcastId,
          status: 'PUBLISHED' as const,
          recipientCount: row?.recipient_count ?? 0,
          publishedAt: row?.published_at ?? new Date().toISOString(),
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
