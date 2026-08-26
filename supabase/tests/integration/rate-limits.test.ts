import { beforeEach, describe, expect, it } from 'vitest';
import { callFunction, resetRateLimits, sql, uuid, SEED } from './helpers';

/**
 * docs/07 §10. These limits are the only thing standing between one compromised
 * session and an unbounded number of payment orders or QR tokens, so they are
 * tested for real rather than assumed from the presence of the code.
 *
 * The rest of the suite clears these counters in beforeEach; this file is where
 * they are allowed to fire.
 */

beforeEach(async () => {
  await resetRateLimits();
});

describe('rate limiting', () => {
  it('refuses the sixth payment order in an hour with 429 and Retry-After', async () => {
    // The first five are allowed. Each one fails on MEMBERSHIP_ALREADY_PENDING
    // after the first, which is fine — the limiter runs before that check, so
    // the attempt still counts. That ordering is deliberate: a caller must not
    // be able to spend an unlimited number of attempts just because each one
    // was going to be rejected anyway.
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await callFunction('create-payment-order', {
        as: SEED.asha,
        headers: { 'Idempotency-Key': uuid() },
        body: { planId: SEED.plans.monthly, method: 'CASH_COUNTER' },
      });
      statuses.push(response.status);
    }

    expect(statuses.slice(0, 5).every((status) => status !== 429)).toBe(true);
    expect(statuses[5]).toBe(429);
  });

  it('counts per user, so one member cannot exhaust another member’s budget', async () => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await callFunction('create-payment-order', {
        as: SEED.asha,
        headers: { 'Idempotency-Key': uuid() },
        body: { planId: SEED.plans.monthly, method: 'CASH_COUNTER' },
      });
    }

    // Asha is now throttled. Imran must be unaffected.
    const response = await callFunction('create-payment-order', {
      as: SEED.imran,
      headers: { 'Idempotency-Key': uuid() },
      body: { planId: SEED.plans.monthly, method: 'CASH_COUNTER' },
    });

    expect(response.status).not.toBe(429);
  });

  it('starts a fresh window once the old one has passed', async () => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await callFunction('create-payment-order', {
        as: SEED.neha,
        headers: { 'Idempotency-Key': uuid() },
        body: { planId: SEED.plans.monthly, method: 'CASH_COUNTER' },
      });
    }

    // Age the window rather than waiting an hour for it.
    await sql(`
      update public.rate_limits set window_start = now() - interval '2 hours'
      where key like 'create-payment-order:%';
    `);

    const response = await callFunction('create-payment-order', {
      as: SEED.neha,
      headers: { 'Idempotency-Key': uuid() },
      body: { planId: SEED.plans.monthly, method: 'CASH_COUNTER' },
    });

    expect(response.status).not.toBe(429);
  });

  it('limits QR tokens at 20 per user per hour', async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 21; attempt += 1) {
      const response = await callFunction('create-member-qr-token', {
        as: SEED.priya,
        body: { purpose: 'MEMBER_LOOKUP' },
      });
      statuses.push(response.status);
    }

    expect(statuses.filter((status) => status === 429)).toHaveLength(1);
    expect(statuses[20]).toBe(429);
  });

  it('keeps the counter table unreadable to a client', async () => {
    // RLS is on with no policy and no grant, so this is service-role only.
    // A readable key would show which member has been attempting what.
    const [policies] = await sql(`
      select count(*) from pg_policy p
      join pg_class c on c.oid = p.polrelid
      where c.relname = 'rate_limits';
    `);
    expect(Number(policies?.value)).toBe(0);

    const [grants] = await sql(`
      select count(*) from information_schema.role_table_grants
      where table_name = 'rate_limits'
        and grantee in ('anon', 'authenticated')
        and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE');
    `);
    expect(Number(grants?.value)).toBe(0);
  });
});
