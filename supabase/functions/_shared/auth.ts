// docs/04 §5 layer 2 — the explicit role check every function makes before it
// does any work. This is where `gym_id` comes from: resolved server-side from
// the caller's own gym_members/gym_staff row, never from the request body.

import { createAdminClient } from './db.ts';
import type { ErrorCode } from './errors.ts';

export type AuthOk = {
  ok: true;
  userId: string;
  gymId: string;
  /** Present only for staff. */
  role?: 'OWNER' | 'STAFF';
};
export type AuthFail = { ok: false; code: ErrorCode };
export type AuthResult = AuthOk | AuthFail;

function bearer(req: Request): string | null {
  const header = req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Establishes *who* the caller is, and nothing more.
 *
 * The token is verified against the auth server rather than decoded locally: a
 * JWT is signed data a client holds, and a locally-decoded `sub` is only as
 * trustworthy as our own signature checking. Letting GoTrue answer means a
 * revoked or expired session fails here.
 */
export async function requireUser(req: Request): Promise<{ ok: true; userId: string } | AuthFail> {
  const token = bearer(req);
  if (!token) return { ok: false, code: 'UNAUTHENTICATED' };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return { ok: false, code: 'UNAUTHENTICATED' };

  return { ok: true, userId: data.user.id };
}

/**
 * The caller must be active staff somewhere. `gymId` is that gym — the request
 * does not get to say which gym it is acting on.
 */
export async function requireStaff(req: Request): Promise<AuthResult> {
  const user = await requireUser(req);
  if (!user.ok) return user;

  const admin = createAdminClient();
  const { data } = await admin
    .from('gym_staff')
    .select('gym_id, role')
    .eq('user_id', user.userId)
    .eq('status', 'ACTIVE')
    .maybeSingle();

  if (!data) return { ok: false, code: 'NOT_GYM_STAFF' };

  return { ok: true, userId: user.userId, gymId: data.gym_id, role: data.role };
}

/** As above, but the caller must additionally be the OWNER. */
export async function requireOwner(req: Request): Promise<AuthResult> {
  const staff = await requireStaff(req);
  if (!staff.ok) return staff;
  if (staff.role !== 'OWNER') return { ok: false, code: 'FORBIDDEN' };
  return staff;
}

/** The caller must be an active member of a gym. */
export async function requireMember(req: Request): Promise<AuthResult> {
  const user = await requireUser(req);
  if (!user.ok) return user;

  const admin = createAdminClient();
  const { data } = await admin
    .from('gym_members')
    .select('gym_id')
    .eq('user_id', user.userId)
    .eq('status', 'ACTIVE')
    .maybeSingle();

  if (!data) return { ok: false, code: 'NOT_GYM_MEMBER' };

  return { ok: true, userId: user.userId, gymId: data.gym_id };
}

export type VerifiedIdentity = {
  /** E.164, present only when the phone was actually confirmed. */
  phone: string | null;
  /** Present only when the email was actually confirmed. */
  email: string | null;
};

/**
 * The identity on the JWT (docs/04 §3, extended by D-021). A phone or email in
 * a request body is a claim, not a fact, and is never accepted.
 *
 * `*_confirmed_at` is the part that matters. A user row can carry an
 * unconfirmed email — someone typed it, nobody proved it — and treating that as
 * an identity would let one person claim another's address. Only confirmed
 * values are returned.
 */
export async function verifiedIdentity(req: Request): Promise<VerifiedIdentity> {
  const token = bearer(req);
  if (!token) return { phone: null, email: null };

  const admin = createAdminClient();
  const { data } = await admin.auth.getUser(token);
  const user = data.user;
  if (!user) return { phone: null, email: null };

  return {
    phone: user.phone && user.phone_confirmed_at ? `+${user.phone.replace(/^\+/, '')}` : null,
    // Lowercased on the way in, matching the case-insensitive unique index, so
    // Asha@x.com and asha@x.com cannot become two members.
    email: user.email && user.email_confirmed_at ? user.email.toLowerCase() : null,
  };
}

/** Raw token, for the rare case a function needs to act as the user under RLS. */
export function accessToken(req: Request): string | null {
  return bearer(req);
}
