// docs/07 §7 — a member reports something.

import { withRequestId, ok, fail, fieldErrors } from '../_shared/response.ts';
import { requireMember } from '../_shared/auth.ts';
import { rateLimit, retryAfterSeconds } from '../_shared/ratelimit.ts';
import { createAdminClient } from '../_shared/db.ts';
import { createIssueSchema } from '../_shared/schemas/requests.ts';

Deno.serve(
  withRequestId(async (req, ctx) => {
    if (req.method !== 'POST') return fail('NOT_FOUND', ctx, req);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail('VALIDATION_FAILED', ctx, req);
    }

    const parsed = createIssueSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_FAILED', ctx, req, fieldErrors(parsed.error));

    const auth = await requireMember(req);
    if (!auth.ok) return fail(auth.code, ctx, req);

    if (await rateLimit('create-issue', auth.userId)) {
      const response = fail('RATE_LIMITED', ctx, req);
      response.headers.set('Retry-After', String(retryAfterSeconds('create-issue')));
      return response;
    }

    const admin = createAdminClient();

    const { data: issue, error } = await admin
      .from('issues')
      .insert({
        gym_id: auth.gymId, // resolved from the caller, not the body
        user_id: auth.userId,
        category: parsed.data.category,
        title: parsed.data.title,
        description: parsed.data.description,
        status: 'OPEN',
      })
      .select('id, status, created_at')
      .single();

    if (error || !issue) return fail('INTERNAL_ERROR', ctx, req);

    // Attachments were uploaded to storage before this call, so the body carries
    // paths rather than bytes. Two things are checked rather than trusted:
    //
    //   * the path must sit under this member's own gym prefix, or a client
    //     could attach a file from another tenant's thread to its own issue;
    //   * the size and type are read from the stored object, never from the
    //     request. The 5 MB check constraint is only meaningful if the number it
    //     checks is the real one.
    if (parsed.data.attachmentPaths?.length) {
      const rows: {
        issue_id: string;
        gym_id: string;
        uploaded_by: string;
        storage_path: string;
        mime_type: string;
        size_bytes: number;
      }[] = [];

      for (const path of parsed.data.attachmentPaths) {
        if (!path.startsWith(`${auth.gymId}/`)) continue;

        const folder = path.slice(0, path.lastIndexOf('/'));
        const name = path.slice(path.lastIndexOf('/') + 1);
        const { data: objects } = await admin.storage
          .from('issue-attachments')
          .list(folder, { search: name, limit: 1 });

        const object = objects?.[0];
        // No object means the upload did not happen, or happened somewhere the
        // caller does not own. Either way there is nothing to record.
        if (!object || object.name !== name) continue;

        const size = object.metadata?.size;
        const mime = object.metadata?.mimetype;
        if (typeof size !== 'number' || typeof mime !== 'string') continue;

        rows.push({
          issue_id: issue.id,
          gym_id: auth.gymId,
          uploaded_by: auth.userId,
          storage_path: path,
          mime_type: mime,
          size_bytes: size,
        });
      }

      // The insert can still be refused by the mime allowlist or the size check.
      // That is the intended last word, so a failure here is not swallowed.
      if (rows.length > 0) {
        const { error: attachmentError } = await admin.from('issue_attachments').insert(rows);
        if (attachmentError) {
          console.warn(
            JSON.stringify({ requestId: ctx.requestId, event: 'attachment_rejected', issueId: issue.id }),
          );
        }
      }
    }

    return ok(
      { issueId: issue.id, status: issue.status, createdAt: issue.created_at },
      ctx,
      req,
      201,
    );
  }),
);
