// docs/07 §5 — is the gym open right now (D-007).
//
// The answer is computed by `current_gym_status` in Postgres rather than here,
// because the schedule, the override window and the gym's timezone all live
// there and a second implementation would drift. Never hardcode a timezone:
// "today" is whatever `gyms.timezone` says (CLAUDE.md rule 7).

import { withRequestId, ok, fail } from '../_shared/response.ts';
import { createAdminClient } from '../_shared/db.ts';
import { uuidSchema } from '../_shared/schemas/common.ts';

Deno.serve(
  withRequestId(async (req, ctx) => {
    if (req.method !== 'GET') return fail('NOT_FOUND', ctx, req);

    const gymId = uuidSchema.safeParse(new URL(req.url).searchParams.get('gymId'));
    if (!gymId.success) return fail('GYM_NOT_FOUND', ctx, req);

    const admin = createAdminClient();
    const { data, error } = await admin.rpc('current_gym_status', { p_gym_id: gymId.data });

    if (error || !data || (Array.isArray(data) && data.length === 0)) {
      return fail('GYM_NOT_FOUND', ctx, req);
    }

    const row = Array.isArray(data) ? data[0] : data;

    return ok(
      {
        status: row.status,
        source: row.source,
        overrideReason: row.override_reason,
        changesAt: row.changes_at,
      },
      ctx,
      req,
    );
  }),
);
