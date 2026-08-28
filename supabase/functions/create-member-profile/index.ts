// docs/07 §3 — called once, straight after phone-OTP verification. This is the
// whole of member registration (CLAUDE.md rule 9: there is no admin-side "add
// member" path).
//
// The phone comes from the JWT, never from the body. A body-supplied phone would
// let anyone claim another member's identity by typing their number, which is
// why `createMemberProfileSchema` has no phone field at all.

import { withRequestId, ok, fail, fieldErrors } from '../_shared/response.ts';
import { requireUser, verifiedIdentity } from '../_shared/auth.ts';
import { createAdminClient } from '../_shared/db.ts';
import { createMemberProfileSchema } from '../_shared/schemas/requests.ts';
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

    const parsed = createMemberProfileSchema.safeParse(body);
    if (!parsed.success) return fail('VALIDATION_FAILED', ctx, req, fieldErrors(parsed.error));

    const user = await requireUser(req);
    if (!user.ok) return fail(user.code, ctx, req);

    const admin = createAdminClient();

    try {
      // Step 1. The identity must be *verified*, not merely present. An
      // unverified phone or email is an unproven claim — someone typed it,
      // nobody proved it — and this row is what everything else hangs off.
      //
      // Either provider is accepted (D-021), but at least one confirmed value
      // is required, which is the same constraint the database enforces.
      const identity = await verifiedIdentity(req);
      if (!identity.phone && !identity.email) throw new AppError('UNAUTHENTICATED');

      // Step 2.
      const { data: gym } = await admin
        .from('gyms')
        .select('id, is_active')
        .eq('slug', parsed.data.gymSlug)
        .maybeSingle();

      if (!gym) throw new AppError('GYM_NOT_FOUND');
      if (!gym.is_active) throw new AppError('GYM_INACTIVE');

      // Step 3. Upsert, so re-running after a dropped connection is harmless.
      // Both identity values come from the JWT; the body carries neither.
      const { error: profileError } = await admin.from('profiles').upsert(
        {
          id: user.userId,
          full_name: parsed.data.fullName,
          phone: identity.phone,
          email: identity.email,
          ...(parsed.data.dateOfBirth ? { date_of_birth: parsed.data.dateOfBirth } : {}),
        },
        { onConflict: 'id' },
      );

      if (profileError) {
        // 23505 is the unique violation on phone or lower(email): this identity
        // already belongs to a different account. Saying so plainly beats a
        // generic 500, and it names a real situation — someone who signed up by
        // phone earlier now returning through Google with the same address.
        if (profileError.code === '23505') throw new AppError('FORBIDDEN');
        throw new AppError('INTERNAL_ERROR');
      }

      // Step 4. Idempotent: a second call returns the existing membership row
      // rather than minting a second member code.
      const { data: existing } = await admin
        .from('gym_members')
        .select('gym_id, member_code, joined_at')
        .eq('gym_id', gym.id)
        .eq('user_id', user.userId)
        .maybeSingle();

      let member = existing;

      if (!member) {
        const { data: code } = await admin.rpc('next_member_code', { p_gym_id: gym.id });

        const { data: inserted, error: memberError } = await admin
          .from('gym_members')
          .insert({ gym_id: gym.id, user_id: user.userId, member_code: code })
          .select('gym_id, member_code, joined_at')
          .single();

        if (memberError) {
          // next_member_code is count-based and race-prone (docs/11 Q6). A
          // unique violation means someone else took the code between the read
          // and the insert; re-read rather than failing the registration.
          const { data: retry } = await admin
            .from('gym_members')
            .select('gym_id, member_code, joined_at')
            .eq('gym_id', gym.id)
            .eq('user_id', user.userId)
            .maybeSingle();
          if (!retry) throw new AppError('INTERNAL_ERROR');
          member = retry;
        } else {
          member = inserted;

          // Step 5. Only audited on first registration, not on every replay.
          await admin.from('audit_logs').insert({
            gym_id: gym.id,
            actor_user_id: user.userId,
            action: 'MEMBER_REGISTERED',
            entity_type: 'gym_member',
            entity_id: null,
            // Never the phone number (docs/04 §13).
            metadata: { member_code: member.member_code },
          });
        }
      }

      const { data: profile } = await admin
        .from('profiles')
        .select('id, full_name, phone, email, avatar_path')
        .eq('id', user.userId)
        .single();

      let avatarUrl: string | null = null;
      if (profile?.avatar_path) {
        const { data: signed } = await admin.storage
          .from('avatars')
          .createSignedUrl(profile.avatar_path, 3600);
        avatarUrl = signed?.signedUrl ?? null;
      }

      return ok(
        {
          profile: {
            id: profile!.id,
            fullName: profile!.full_name,
            // Returned to its own owner, who already knows both.
            phone: profile!.phone,
            email: profile!.email,
            avatarUrl,
          },
          member: {
            gymId: member!.gym_id,
            memberCode: member!.member_code,
            joinedAt: member!.joined_at,
          },
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
