// GENERATED MIRROR — do not edit.
//
// Source: packages/domain/src/state/membership.ts (D-012).
// Deno cannot import a pnpm workspace package, so this is a copy. Edit the
// source and run `pnpm test:shared-parity --write`; CI fails if the two drift.

// docs/09 §2 — Membership. EXPIRING is derived, never stored (D-002).
import { allow, deny, type Result, type TransitionError } from '../errors.ts';

export const MEMBERSHIP_STATUSES = [
  'PENDING_PAYMENT',
  'ACTIVE',
  'EXPIRED',
  'CANCELLED',
] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

/** Derived for display only — never written to a column (D-002). */
export type DerivedMembershipStatus = MembershipStatus | 'EXPIRING';

const ALLOWED: Record<MembershipStatus, readonly MembershipStatus[]> = {
  PENDING_PAYMENT: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['EXPIRED', 'CANCELLED'],
  EXPIRED: [],
  CANCELLED: [],
};

export function isMembershipStatus(value: unknown): value is MembershipStatus {
  return typeof value === 'string' && (MEMBERSHIP_STATUSES as readonly string[]).includes(value);
}

export function canTransition(
  from: MembershipStatus,
  to: MembershipStatus,
): Result<void, TransitionError> {
  // Re-activating an already-ACTIVE membership is the idempotent replay path
  // of activate_membership_for_payment(); it succeeds and writes nothing.
  if (from === to) return allow();
  return ALLOWED[from].includes(to) ? allow() : deny('INVALID_MEMBERSHIP_TRANSITION', from, to);
}

export function isTerminal(status: MembershipStatus): boolean {
  return ALLOWED[status].length === 0;
}
