// docs/07 §10 — application-level limits, checked at the top of each function.
// These are in addition to whatever the provider enforces, not instead of it.

import { createAdminClient } from './db.ts';

/** The limits from docs/07 §10, in one place so a function cannot invent one. */
export const LIMITS = {
  'create-payment-order': { limit: 5, window: '1 hour' },
  'create-member-qr-token': { limit: 20, window: '1 hour' },
  'create-issue': { limit: 5, window: '1 day' },
  'attendance-event': { limit: 10, window: '1 hour' },
  'publish-broadcast': { limit: 20, window: '1 day' },
  'file-upload': { limit: 20, window: '1 day' },
} as const;

export type LimitedOperation = keyof typeof LIMITS;

/**
 * Returns true when the caller has exceeded the limit.
 *
 * The counting is done by `check_rate_limit` in Postgres, not here: an atomic
 * upsert cannot be raced, whereas a read-then-write in this process would let a
 * burst of concurrent requests all see the same pre-increment count.
 *
 * `scope` is the subject being limited — a user id for per-user limits, a gym id
 * for per-gym ones. It is never a value taken from the request body, or a caller
 * could spend someone else's budget by naming them.
 */
export async function rateLimit(operation: LimitedOperation, scope: string): Promise<boolean> {
  const { limit, window } = LIMITS[operation];
  const admin = createAdminClient();

  const { data, error } = await admin.rpc('check_rate_limit', {
    p_key: `${operation}:${scope}`,
    p_limit: limit,
    p_window: window,
  });

  if (error) {
    // Fail closed. A limiter that silently stops working during a database
    // problem is worse than one that briefly refuses traffic, because the
    // failure is invisible exactly when it matters.
    console.error(JSON.stringify({ scope: operation, message: 'rate limit check failed' }));
    return true;
  }

  return data === true;
}

/** docs/07 §10 — a 429 carries Retry-After so a client can back off sensibly. */
export function retryAfterSeconds(operation: LimitedOperation): number {
  return LIMITS[operation].window === '1 day' ? 86_400 : 3_600;
}
