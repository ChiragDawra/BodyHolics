import { beforeEach, describe, expect, it } from 'vitest';
import {
  callFunction,
  clearPendingMembership,
  resetRateLimits,
  sql,
  uuid,
  SEED,
} from './helpers';

/**
 * The counter flow is the one place a staff member can turn a scan into an
 * activated membership. The QR token is the authorization, so most of what
 * matters here is what happens when the token is wrong, stale, or reused.
 */

async function orderFor(userId: string, planId: string) {
  // Both preconditions, established rather than assumed: D-004 permits one
  // pending membership, and the per-user hourly limit is low enough that a few
  // arrange steps in the same file would otherwise trip it.
  await clearPendingMembership(userId);
  await resetRateLimits();

  const response = await callFunction<{ paymentId: string; amountPaise: number }>(
    'create-payment-order',
    {
      as: userId,
      headers: { 'Idempotency-Key': uuid() },
      body: { planId, method: 'CASH_COUNTER' },
    },
  );

  expect(response.status, `orderFor(${userId}): ${JSON.stringify(response.error)}`).toBe(201);
  return response.data!;
}

async function tokenFor(userId: string, paymentId: string) {
  const response = await callFunction<{ token: string }>('create-member-qr-token', {
    as: userId,
    body: { purpose: 'COUNTER_PAYMENT', paymentId },
  });
  expect(response.status).toBe(201);
  return response.data!.token;
}

beforeEach(async () => {
  await resetRateLimits();
});

describe('create-member-qr-token', () => {
  it('stores only the sha256 hash, never the raw token', async () => {
    const response = await callFunction<{ token: string }>('create-member-qr-token', {
      as: SEED.asha,
      body: { purpose: 'MEMBER_LOOKUP' },
    });

    expect(response.status).toBe(201);
    const raw = response.data!.token;

    const [found] = await sql(
      `select count(*) from public.member_qr_tokens where token_hash = '${raw}';`,
    );
    expect(Number(found?.value)).toBe(0);

    const [hashed] = await sql(`
      select count(*) from public.member_qr_tokens
      where token_hash = encode(digest('${raw}', 'sha256'), 'hex');
    `);
    expect(Number(hashed?.value)).toBe(1);
  });

  it('refuses to mint a counter token against another member’s payment', async () => {
    const order = await orderFor(SEED.neha, SEED.plans.monthly);

    // Imran asks for a token against Neha's payment.
    const response = await callFunction('create-member-qr-token', {
      as: SEED.imran,
      body: { purpose: 'COUNTER_PAYMENT', paymentId: order.paymentId },
    });

    expect(response.status).toBe(404);
    expect(response.error?.code).toBe('PAYMENT_NOT_FOUND');
  });

  it('invalidates the previous unused token for the same purpose', async () => {
    const first = await callFunction<{ token: string }>('create-member-qr-token', {
      as: SEED.imran,
      body: { purpose: 'MEMBER_LOOKUP' },
    });
    await callFunction('create-member-qr-token', {
      as: SEED.imran,
      body: { purpose: 'MEMBER_LOOKUP' },
    });

    // A screenshot of the first QR must stop working the moment a second is made.
    const [spent] = await sql(`
      select used_at is not null from public.member_qr_tokens
      where token_hash = encode(digest('${first.data!.token}', 'sha256'), 'hex');
    `);
    expect(spent?.value).toBe('t');
  });
});

describe('confirm-counter-payment', () => {
  it('activates the membership when staff scan a valid token', async () => {
    const order = await orderFor(SEED.priya, SEED.plans.monthly);
    const token = await tokenFor(SEED.priya, order.paymentId);

    const response = await callFunction<{
      payment: { status: string; amountPaise: number };
      membership: { status: string; endAt: string };
      member: { memberCode: string };
    }>('confirm-counter-payment', {
      as: SEED.owner,
      headers: { 'Idempotency-Key': uuid() },
      body: { memberQrToken: token, method: 'CASH_COUNTER' },
    });

    expect(response.error?.code, JSON.stringify(response.error)).toBeUndefined();
    expect(response.status).toBe(200);
    expect(response.data?.payment.status).toBe('PAID');
    // The amount came from the plan row, not from the scan.
    expect(response.data?.payment.amountPaise).toBe(149900);
    expect(response.data?.membership.status).toBe('ACTIVE');
    expect(response.data?.member.memberCode).toBe('UG-0005');
  });

  it('refuses a member trying to confirm their own payment', async () => {
    const order = await orderFor(SEED.neha, SEED.plans.monthly);
    const token = await tokenFor(SEED.neha, order.paymentId);

    const response = await callFunction('confirm-counter-payment', {
      as: SEED.neha,
      headers: { 'Idempotency-Key': uuid() },
      body: { memberQrToken: token, method: 'CASH_COUNTER' },
    });

    expect(response.status).toBe(403);
    expect(response.error?.code).toBe('NOT_GYM_STAFF');
  });

  it('refuses a replayed token, so a membership cannot be extended twice', async () => {
    const order = await orderFor(SEED.imran, SEED.plans.monthly);
    const token = await tokenFor(SEED.imran, order.paymentId);

    const first = await callFunction('confirm-counter-payment', {
      as: SEED.owner,
      headers: { 'Idempotency-Key': uuid() },
      body: { memberQrToken: token, method: 'CASH_COUNTER' },
    });
    expect(first.status).toBe(200);

    const second = await callFunction('confirm-counter-payment', {
      as: SEED.owner,
      headers: { 'Idempotency-Key': uuid() },
      body: { memberQrToken: token, method: 'CASH_COUNTER' },
    });

    expect(second.status).toBe(409);
    expect(second.error?.code).toBe('QR_TOKEN_ALREADY_USED');
  });

  it('refuses a token that never existed', async () => {
    const response = await callFunction('confirm-counter-payment', {
      as: SEED.owner,
      headers: { 'Idempotency-Key': uuid() },
      body: { memberQrToken: 'not-a-real-token-value-at-all-000000000000', method: 'CASH_COUNTER' },
    });

    expect(response.status).toBe(400);
    expect(response.error?.code).toBe('QR_TOKEN_INVALID');
  });

  it('refuses an expired token', async () => {
    const order = await orderFor(SEED.neha, SEED.plans.monthly);
    const token = await tokenFor(SEED.neha, order.paymentId);

    // Age it past its 120s TTL rather than waiting for it.
    await sql(`
      update public.member_qr_tokens set expires_at = now() - interval '1 minute'
      where token_hash = encode(digest('${token}', 'sha256'), 'hex');
    `);

    const response = await callFunction('confirm-counter-payment', {
      as: SEED.owner,
      headers: { 'Idempotency-Key': uuid() },
      body: { memberQrToken: token, method: 'CASH_COUNTER' },
    });

    expect(response.status).toBe(409);
    expect(response.error?.code).toBe('QR_TOKEN_EXPIRED');
  });

  it('writes an audit row naming the staff member who took the money', async () => {
    const order = await orderFor(SEED.neha, SEED.plans.quarterly);
    const token = await tokenFor(SEED.neha, order.paymentId);

    await callFunction('confirm-counter-payment', {
      as: SEED.owner,
      headers: { 'Idempotency-Key': uuid() },
      body: { memberQrToken: token, method: 'UPI_COUNTER' },
    });

    const [audited] = await sql(`
      select count(*) from public.audit_logs
      where action = 'COUNTER_PAYMENT_CONFIRMED'
        and entity_id = '${order.paymentId}'
        and actor_user_id = '${SEED.owner}';
    `);
    expect(Number(audited?.value)).toBe(1);

    // The raw token must never reach the audit trail (docs/04 §13).
    const [leaked] = await sql(`
      select count(*) from public.audit_logs where metadata::text like '%${token}%';
    `);
    expect(Number(leaked?.value)).toBe(0);
  });
});
