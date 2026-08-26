// docs/09 §6 — Member QR token. State is derived from used_at/expires_at;
// there is no status column.
import type { ErrorCode } from '../errors';

export const QR_TOKEN_PURPOSES = ['COUNTER_PAYMENT', 'MEMBER_LOOKUP'] as const;
export type QrTokenPurpose = (typeof QR_TOKEN_PURPOSES)[number];

export type QrTokenState = 'VALID' | 'USED' | 'EXPIRED';

/** TTL per purpose, in seconds (docs/04 §9, docs/09 §6). */
export const QR_TOKEN_TTL_SECONDS: Record<QrTokenPurpose, number> = {
  COUNTER_PAYMENT: 120,
  MEMBER_LOOKUP: 300,
};

/** The member app refreshes at 100s so a stale QR is never on screen. */
export const QR_REFRESH_AFTER_SECONDS = 100;

export interface QrTokenRow {
  usedAt: Date | null;
  expiresAt: Date;
}

export function qrTokenState(token: QrTokenRow, now: Date = new Date()): QrTokenState {
  if (token.usedAt !== null) return 'USED';
  return token.expiresAt.getTime() > now.getTime() ? 'VALID' : 'EXPIRED';
}

/** Maps a derived state to the error code the API returns on redemption. */
export function redemptionError(state: QrTokenState): ErrorCode | null {
  switch (state) {
    case 'VALID':
      return null;
    case 'USED':
      return 'QR_TOKEN_ALREADY_USED';
    case 'EXPIRED':
      return 'QR_TOKEN_EXPIRED';
  }
}

export function expiresAtFor(purpose: QrTokenPurpose, issuedAt: Date = new Date()): Date {
  return new Date(issuedAt.getTime() + QR_TOKEN_TTL_SECONDS[purpose] * 1000);
}

/** Seconds until the app should fetch a fresh token; never negative. */
export function secondsUntilRefresh(expiresAt: Date, now: Date = new Date()): number {
  const remaining = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
  const refreshIn = remaining - (QR_TOKEN_TTL_SECONDS.COUNTER_PAYMENT - QR_REFRESH_AFTER_SECONDS);
  return refreshIn > 0 ? refreshIn : 0;
}
