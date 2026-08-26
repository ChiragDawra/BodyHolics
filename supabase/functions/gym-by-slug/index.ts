// docs/07 §3 — public. This is what a scanned QR code resolves to, before the
// scanner has an account, so it is deliberately unauthenticated.
//
// Because it is public it returns a fixed, minimal projection. `gyms` also holds
// operational tuning (expiry_warning_days, presence_ttl_minutes,
// crowd_thresholds) and none of that is anyone's business here.

import { withRequestId, ok, fail } from '../_shared/response.ts';
import { createAdminClient } from '../_shared/db.ts';
import { gymSlugSchema } from '../_shared/schemas/common.ts';

Deno.serve(
  withRequestId(async (req, ctx) => {
    if (req.method !== 'GET') return fail('NOT_FOUND', ctx, req);

    const slug = gymSlugSchema.safeParse(new URL(req.url).searchParams.get('slug'));
    // A malformed slug is reported as "no such gym" rather than as a validation
    // error, so this endpoint cannot be used to probe the slug format.
    if (!slug.success) return fail('GYM_NOT_FOUND', ctx, req);

    const admin = createAdminClient();
    const { data: gym } = await admin
      .from('gyms')
      .select('id, slug, name, logo_path, timezone, is_active')
      .eq('slug', slug.data)
      .maybeSingle();

    if (!gym) return fail('GYM_NOT_FOUND', ctx, req);
    if (!gym.is_active) return fail('GYM_INACTIVE', ctx, req);

    // gym-assets is a public bucket, so this is a plain URL rather than a signed
    // one — nothing in it is private.
    const logoUrl = gym.logo_path
      ? admin.storage.from('gym-assets').getPublicUrl(gym.logo_path).data.publicUrl
      : null;

    return ok(
      {
        id: gym.id,
        slug: gym.slug,
        name: gym.name,
        logoUrl,
        timezone: gym.timezone,
        isActive: gym.is_active,
      },
      ctx,
      req,
    );
  }),
);
