// GENERATED MIRROR — do not edit.
//
// Source: packages/domain/src/errors.ts (D-012).
// Deno cannot import a pnpm workspace package, so this is a copy. Edit the
// source and run `pnpm test:shared-parity --write`; CI fails if the two drift.

// The single registry of user-facing error codes. Mirrored for Deno in
// supabase/functions/_shared/errors.ts (D-012) and kept in sync by
// `pnpm test:shared-parity`. Adding a code here means adding it to docs/07 §2
// in the same change.

export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_GYM_STAFF',
  'NOT_GYM_MEMBER',
  'CROSS_TENANT_ACCESS',
  'NOT_FOUND',
  'GYM_NOT_FOUND',
  'GYM_INACTIVE',
  'PLAN_NOT_FOUND',
  'PLAN_INACTIVE',
  'MEMBERSHIP_ALREADY_PENDING',
  'INVALID_MEMBERSHIP_TRANSITION',
  'PAYMENT_NOT_FOUND',
  'PAYMENT_ALREADY_PROCESSED',
  'PAYMENT_NOT_PENDING',
  'INVALID_PAYMENT_TRANSITION',
  'PAYMENT_PROVIDER_ERROR',
  'WEBHOOK_SIGNATURE_INVALID',
  'QR_TOKEN_INVALID',
  'QR_TOKEN_EXPIRED',
  'QR_TOKEN_ALREADY_USED',
  'BROADCAST_IMMUTABLE',
  'BROADCAST_EMPTY_AUDIENCE',
  'ISSUE_CLOSED',
  'INVALID_ISSUE_TRANSITION',
  'OVERRIDE_RANGE_INVALID',
  'FILE_TOO_LARGE',
  'UNSUPPORTED_FILE_TYPE',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/**
 * What a member or staff user actually reads. Never contains SQL, a stack
 * trace, a provider payload, or a UUID (docs/06 §8).
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_FAILED: 'Please check the details you entered and try again.',
  UNAUTHENTICATED: 'Please sign in to continue.',
  FORBIDDEN: "You don't have access to this.",
  NOT_GYM_STAFF: "You don't have access to this.",
  NOT_GYM_MEMBER: "You don't have access to this.",
  CROSS_TENANT_ACCESS: "You don't have access to this.",
  NOT_FOUND: "We couldn't find that.",
  GYM_NOT_FOUND: "We couldn't find that gym.",
  GYM_INACTIVE: 'This gym is not accepting new members right now.',
  PLAN_NOT_FOUND: "We couldn't find that plan.",
  PLAN_INACTIVE: 'That plan is no longer available. Please pick another one.',
  MEMBERSHIP_ALREADY_PENDING: 'You already have a membership awaiting payment.',
  INVALID_MEMBERSHIP_TRANSITION: "That membership can't be changed this way.",
  PAYMENT_NOT_FOUND: "We couldn't find that payment.",
  PAYMENT_ALREADY_PROCESSED: 'This payment has already been processed.',
  PAYMENT_NOT_PENDING: 'This payment is no longer awaiting confirmation.',
  INVALID_PAYMENT_TRANSITION: "That payment can't be changed this way.",
  PAYMENT_PROVIDER_ERROR: "The payment provider didn't respond. Please try again.",
  WEBHOOK_SIGNATURE_INVALID: 'Request rejected.',
  QR_TOKEN_INVALID: 'That code is not valid. Ask the member to show a fresh one.',
  QR_TOKEN_EXPIRED: 'That code has expired. Ask the member to show a fresh one.',
  QR_TOKEN_ALREADY_USED: 'That code has already been used.',
  BROADCAST_IMMUTABLE: 'A published announcement cannot be edited. Send a new one.',
  BROADCAST_EMPTY_AUDIENCE: 'No members match this audience, so nothing was sent.',
  ISSUE_CLOSED: 'This issue is closed. Please raise a new one.',
  INVALID_ISSUE_TRANSITION: "That issue can't be moved to this status.",
  OVERRIDE_RANGE_INVALID: 'The end time must be after the start time.',
  FILE_TOO_LARGE: 'That file is too large.',
  UNSUPPORTED_FILE_TYPE: "That file type isn't supported.",
  RATE_LIMITED: 'Too many attempts. Please wait a moment and try again.',
  INTERNAL_ERROR: 'Something went wrong on our side. Please try again.',
};

export function messageFor(code: string): string {
  return (ERROR_MESSAGES as Record<string, string>)[code] ?? ERROR_MESSAGES.INTERNAL_ERROR;
}

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && value in ERROR_MESSAGES;
}

/** The normalized error every `api.ts` throws (docs/06 §8). */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly requestId: string | undefined;

  constructor(code: ErrorCode, requestId?: string) {
    super(messageFor(code));
    this.name = 'AppError';
    this.code = code;
    this.requestId = requestId;
  }
}

/** Result of a state-machine check. */
export type TransitionError = { code: ErrorCode; from: string; to: string };
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const allow = (): Result<void, TransitionError> => ({ ok: true, value: undefined });
export const deny = (
  code: ErrorCode,
  from: string,
  to: string,
): Result<void, TransitionError> => ({ ok: false, error: { code, from, to } });
