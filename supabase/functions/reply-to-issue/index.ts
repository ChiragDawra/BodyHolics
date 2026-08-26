// docs/07 §7 — a message on an issue thread, from either side.
//
// Two side effects that docs/09 §4 requires and that a plain table insert would
// miss, which is why this is a function and not a direct write:
//   * a staff reply acknowledges the issue and moves OPEN -> IN_PROGRESS;
//   * a member replying to their own RESOLVED issue within 7 days reopens it.

import { withRequestId, ok, fail, fieldErrors } from '../_shared/response.ts';
import { requireUser } from '../_shared/auth.ts';
import { createAdminClient } from '../_shared/db.ts';
import { replyToIssueSchema } from '../_shared/schemas/requests.ts';
import { AppError } from '../_shared/errors.ts';
import { canTransition } from '../_shared/state/issue.ts';

Deno.serve(
  withRequestId(async (req, ctx) => {
    if (req.method !== 'POST') return fail('NOT_FOUND', ctx, req);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail('VALIDATION_FAILED', ctx, req);
    }

    const parsed = replyToIssueSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_FAILED', ctx, req, fieldErrors(parsed.error));

    const user = await requireUser(req);
    if (!user.ok) return fail(user.code, ctx, req);

    const admin = createAdminClient();

    try {
      const { data: issue } = await admin
        .from('issues')
        .select('id, gym_id, user_id, status, acknowledged_at, resolved_at')
        .eq('id', parsed.data.issueId)
        .maybeSingle();

      if (!issue) throw new AppError('NOT_FOUND');

      // Who is speaking decides what they may do. Staff-ness is read live from
      // gym_staff, scoped to *this issue's* gym — staff at another gym are not
      // staff here.
      const { data: staff } = await admin
        .from('gym_staff')
        .select('gym_id')
        .eq('user_id', user.userId)
        .eq('gym_id', issue.gym_id)
        .eq('status', 'ACTIVE')
        .maybeSingle();

      const isStaff = Boolean(staff);
      const isOwner = issue.user_id === user.userId;

      // Neither party: a 404, so the endpoint cannot confirm an issue id exists.
      if (!isStaff && !isOwner) throw new AppError('NOT_FOUND');

      if (issue.status === 'CLOSED') throw new AppError('ISSUE_CLOSED');

      const authorRole = isStaff ? 'STAFF' : 'MEMBER';

      const { error: messageError } = await admin.from('issue_messages').insert({
        issue_id: issue.id,
        gym_id: issue.gym_id,
        author_user_id: user.userId,
        author_role: authorRole,
        body: parsed.data.body,
      });

      if (messageError) throw new AppError('INTERNAL_ERROR');

      const patch: Record<string, unknown> = {};

      if (isStaff) {
        // D-003: the first staff reply is the acknowledgement.
        if (!issue.acknowledged_at) patch.acknowledged_at = new Date().toISOString();
        if (issue.status === 'OPEN') patch.status = 'IN_PROGRESS';
      } else if (issue.status === 'RESOLVED') {
        // The reopen window is a rule, and the rule lives in the state machine
        // rather than being restated here as a date comparison.
        const daysSinceResolved = issue.resolved_at
          ? Math.floor((Date.now() - Date.parse(issue.resolved_at)) / 86_400_000)
          : Number.POSITIVE_INFINITY;

        const allowed = canTransition('RESOLVED', 'IN_PROGRESS', {
          actor: 'MEMBER',
          daysSinceResolved,
        });

        if (allowed.ok) {
          patch.status = 'IN_PROGRESS';
          patch.resolved_at = null;
          patch.resolved_by = null;
        }
        // Outside the window the message still posts; the issue simply stays
        // RESOLVED. Refusing the message would lose what the member wrote.
      }

      if (Object.keys(patch).length > 0) {
        await admin.from('issues').update(patch).eq('id', issue.id);

        if (patch.status) {
          await admin.from('notifications').insert({
            gym_id: issue.gym_id,
            user_id: issue.user_id,
            source_type: 'ISSUE',
            source_id: issue.id,
            title: 'Update on your report',
            body:
              patch.status === 'IN_PROGRESS' && isStaff
                ? 'The gym is looking into your report.'
                : 'Your report has been reopened.',
            category: 'ISSUE',
          });
        }
      }

      return ok(
        { issueId: issue.id, status: (patch.status as string) ?? issue.status, authorRole },
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
