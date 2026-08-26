// Shared setup for the Edge Function integration tests.
//
// These run against the local stack (`supabase start` + `supabase functions
// serve`), not against a mock. The whole point is to exercise the real auth
// check, the real RLS, and the real database functions — a mocked Supabase would
// test only that the mock agrees with itself.

import { createHmac } from 'node:crypto';

export const API_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
export const FUNCTIONS_URL = `${API_URL}/functions/v1`;

const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET ?? '';

if (!ANON_KEY || !JWT_SECRET) {
  throw new Error(
    'Set SUPABASE_ANON_KEY and SUPABASE_JWT_SECRET before running the integration tests.\n' +
      'They are printed by `supabase status -o env`.',
  );
}

/** The fixed ids from supabase/seed/seed.sql. */
export const SEED = {
  gymId: '11111111-1111-4111-8111-111111111111',
  owner: '22222222-2222-4222-8222-222222222222',
  asha: '33333333-3333-4333-8333-333333333331', // ACTIVE membership, +60 days
  imran: '33333333-3333-4333-8333-333333333332', // ACTIVE, expiring in 3 days
  neha: '33333333-3333-4333-8333-333333333333', // EXPIRED
  vikram: '33333333-3333-4333-8333-333333333334', // PENDING_PAYMENT
  priya: '33333333-3333-4333-8333-333333333335', // no membership at all
  plans: {
    monthly: '44444444-4444-4444-8444-444444444441',
    quarterly: '44444444-4444-4444-8444-444444444442',
    annual: '44444444-4444-4444-8444-444444444443',
  },
  /** A user id belonging to no gym — stands in for another tenant. */
  outsider: '00000000-0000-4000-8000-0000000000ff',
} as const;

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Mints a session token for a seeded user.
 *
 * Phone OTP has no SMS provider on the local stack (docs/11 Q1), so signing a
 * member in through the auth API is not possible here. Signing the same claims
 * GoTrue would issue exercises every layer past authentication, which is the
 * part these tests are about.
 */
export function tokenFor(userId: string): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(
    JSON.stringify({
      sub: userId,
      role: 'authenticated',
      aud: 'authenticated',
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = base64url(
    createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest(),
  );
  return `${header}.${payload}.${signature}`;
}

export type ApiResponse<T = unknown> = {
  status: number;
  data?: T;
  error?: { code: string; message: string; details: Record<string, string> | null };
};

export async function callFunction<T = unknown>(
  name: string,
  options: {
    method?: 'GET' | 'POST';
    as?: string;
    body?: unknown;
    query?: Record<string, string>;
    headers?: Record<string, string>;
  } = {},
): Promise<ApiResponse<T>> {
  const query = options.query ? `?${new URLSearchParams(options.query)}` : '';
  const headers: Record<string, string> = {
    apikey: ANON_KEY,
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (options.as) headers.Authorization = `Bearer ${tokenFor(options.as)}`;

  const response = await fetch(`${FUNCTIONS_URL}/${name}${query}`, {
    method: options.method ?? 'POST',
    headers,
    ...(options.method === 'GET' ? {} : { body: JSON.stringify(options.body ?? {}) }),
  });

  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    parsed = { raw: text };
  }

  return {
    status: response.status,
    data: parsed.data as T | undefined,
    error: parsed.error as ApiResponse['error'],
  };
}

/** Signs a webhook body the way Razorpay would. */
export function signWebhook(rawBody: string): string {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error('RAZORPAY_WEBHOOK_SECRET is required for the webhook tests');
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

export function uuid(): string {
  return crypto.randomUUID();
}

/** Direct SQL, for arranging state and asserting side effects the API hides. */
export async function sql<T = Record<string, unknown>>(statement: string): Promise<T[]> {
  const { execFileSync } = await import('node:child_process');
  const output = execFileSync(
    'docker',
    ['exec', '-i', 'supabase_db_BodyHolics', 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-c', statement],
    { encoding: 'utf8' },
  );
  return output
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => ({ value: line }) as unknown as T);
}

/**
 * Arranges a fresh PENDING online payment for a user and returns its id.
 *
 * It clears any existing pending membership for that user first. D-004 allows
 * only one, so without this the arrange step depends on what earlier tests
 * happened to leave behind — and a test that fails because of its neighbours is
 * worse than no test.
 */
export async function arrangePendingPayment(params: {
  userId: string;
  planId: string;
  amountPaise: number;
  orderId: string;
}): Promise<string> {
  await sql(`
    update public.memberships set status = 'CANCELLED', cancelled_at = now()
    where gym_id = '${SEED.gymId}' and user_id = '${params.userId}'
      and status = 'PENDING_PAYMENT';
  `);

  const rows = await sql(`
    with m as (
      insert into public.memberships (gym_id, user_id, plan_id, status, price_paise)
      values ('${SEED.gymId}', '${params.userId}', '${params.planId}', 'PENDING_PAYMENT', ${params.amountPaise})
      returning id
    )
    insert into public.payments
      (gym_id, user_id, membership_id, amount_paise, method, status, provider, provider_order_id)
    select '${SEED.gymId}', '${params.userId}', m.id, ${params.amountPaise}, 'ONLINE', 'PENDING', 'RAZORPAY', '${params.orderId}'
    from m returning id;
  `);

  const paymentId = rows[0]?.value;
  if (!paymentId) throw new Error('failed to arrange a pending payment');
  return paymentId as string;
}

/**
 * Clears the rate-limit counters.
 *
 * The limits are real and are tested deliberately in rate-limits.test.ts. Left
 * in place across the rest of the suite they throttle unrelated tests, which
 * turns a passing assertion into a 429 for reasons that have nothing to do with
 * what the test is about.
 */
export async function resetRateLimits(): Promise<void> {
  await sql('delete from public.rate_limits;');
}
