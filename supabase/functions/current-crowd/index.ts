// docs/07 §8 — how busy the gym is, as a bucket.
//
// The hard rule here is the one from docs/05 §5: a member never receives a
// sample size, an exact headcount, or any identifier. `crowd_level` returns the
// sample size and is revoked from `authenticated` for exactly that reason; this
// endpoint reads it with the service key and returns only the bucket.

import { withRequestId, ok, fail } from '../_shared/response.ts';
import { requireMember } from '../_shared/auth.ts';
import { createAdminClient } from '../_shared/db.ts';
import { uuidSchema } from '../_shared/schemas/common.ts';

Deno.serve(
  withRequestId(async (req, ctx) => {
    if (req.method !== 'GET') return fail('NOT_FOUND', ctx, req);

    const gymId = uuidSchema.safeParse(new URL(req.url).searchParams.get('gymId'));
    if (!gymId.success) return fail('VALIDATION_FAILED', ctx, req);

    const auth = await requireMember(req);
    if (!auth.ok) return fail(auth.code, ctx, req);

    // Asking about someone else's gym is a 404, not a 403 (docs/07 §1).
    if (gymId.data !== auth.gymId) return fail('NOT_FOUND', ctx, req);

    const admin = createAdminClient();
    const { data, error } = await admin.rpc('crowd_level', { p_gym_id: auth.gymId });
    if (error) return fail('INTERNAL_ERROR', ctx, req);

    const row = Array.isArray(data) ? data[0] : data;

    const { data: snapshot } = await admin
      .from('crowd_snapshots')
      .select('captured_at, source_type')
      .eq('gym_id', auth.gymId)
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return ok(
      {
        level: row?.level ?? null,
        confidence: row?.confidence ?? 'INSUFFICIENT_DATA',
        updatedAt: snapshot?.captured_at ?? new Date().toISOString(),
        source: snapshot?.source_type ?? 'QR',
        // row.sample_size is deliberately not returned.
      },
      ctx,
      req,
    );
  }),
);
