// docs/07 §7 — staff move an issue along. The permitted moves are docs/09 §4's,
// and they are checked by the shared state machine rather than by an if-ladder
// written twice.

import { withRequestId, ok, fail, fieldErrors } from '../_shared/response.ts';
import { requireStaff } from '../_shared/auth.ts';
import { createAdminClient } from '../_shared/db.ts';
import { updateIssueStatusSchema } from '../_shared/schemas/requests.ts';
import { AppError } from '../_shared/errors.ts';
import { canTransition, type IssueStatus } from '../_shared/state/issue.ts';

Deno.serve(
  withRequestId(async (req, ctx) => {
    if (req.method !== 'POST') return fail('NOT_FOUND', ctx, req);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail('VALIDATION_FAILED', ctx, req);
    }

    const parsed = updateIssueStatusSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_FAILED', ctx, req, fieldErrors(parsed.error));

    const auth = await requireStaff(req);
    if (!auth.ok) return fail(auth.code, ctx, req);

    const admin = createAdminClient();

    try {
      const { data: issue } = await admin
        .from('issues')
        .select('id, gym_id, user_id, status, title')
        .eq('id', parsed.data.issueId)
        .maybeSingle();

      // An issue at another gym is a 404 — the same answer as one that does not
      // exist, so this cannot be used to discover another tenant's issue ids.
      if (!issue || issue.gym_id !== auth.gymId) throw new AppError('NOT_FOUND');

      const from = issue.status as IssueStatus;
      const to = parsed.data.status;

      if (from === to) {
        return ok({ issueId: issue.id, status: to, noop: true }, ctx, req);
      }

      const allowed = canTransition(from, to, { actor: 'STAFF' });
      if (!allowed.ok) throw new AppError(allowed.error.code);

      const now = new Date().toISOString();
      const patch: Record<string, unknown> = { status: to };

      if (to === 'IN_PROGRESS') patch.acknowledged_at = now;
      if (to === 'RESOLVED') {
        patch.resolved_at = now;
        patch.resolved_by = auth.userId;
        patch.acknowledged_at = now;
      }

      const { error: updateError } = await admin
        .from('issues')
        .update(patch)
        .eq('id', issue.id)
        .eq('status', from); // conditional, so a concurrent change loses cleanly

      if (updateError) throw new AppError('INTERNAL_ERROR');

      if (parsed.data.message) {
        await admin.from('issue_messages').insert({
          issue_id: issue.id,
          gym_id: issue.gym_id,
          author_user_id: auth.userId,
          author_role: 'STAFF',
          body: parsed.data.message,
        });
      }

      // docs/07 §7: every status change notifies the member and is audited.
      await admin.from('notifications').insert({
        gym_id: issue.gym_id,
        user_id: issue.user_id,
        source_type: 'ISSUE',
        source_id: issue.id,
        title: 'Update on your report',
        body:
          to === 'RESOLVED'
            ? 'Your report has been marked resolved.'
            : to === 'CLOSED'
              ? 'Your report has been closed.'
              : 'The gym is looking into your report.',
        category: 'ISSUE',
      });

      await admin.from('audit_logs').insert({
        gym_id: issue.gym_id,
        actor_user_id: auth.userId,
        action: `ISSUE_${to}`,
        entity_type: 'issue',
        entity_id: issue.id,
        metadata: { from, to },
      });

      return ok({ issueId: issue.id, status: to, noop: false }, ctx, req);
    } catch (error) {
      if (error instanceof AppError) return fail(error.code, ctx, req);
      console.error(JSON.stringify({ requestId: ctx.requestId, message: String(error) }));
      return fail('INTERNAL_ERROR', ctx, req);
    }
  }),
);
