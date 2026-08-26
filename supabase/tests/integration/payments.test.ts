import { beforeEach, describe, expect, it } from 'vitest';
import {
  arrangePendingPayment,
  callFunction,
  signWebhook,
  sql,
  uuid,
  FUNCTIONS_URL,
  SEED,
  resetRateLimits,
  clearPendingMembership,
} from './helpers';

/**
 * docs/07 §11 — happy path, wrong role, cross-tenant, replay. These are the
 * paths where a mistake costs money or gives away access, so each one is
 * exercised against the real stack rather than reasoned about.
 */

beforeEach(async () => {
  await resetRateLimits();
});

describe('create-payment-order', () => {
  it('takes the amount from the plan, never from the client', async () => {
    await clearPendingMembership(SEED.priya);

    const response = await callFunction<{ amountPaise: number }>('create-payment-order', {
      as: SEED.priya,
      headers: { 'Idempotency-Key': uuid() },
      body: { planId: SEED.plans.monthly, method: 'CASH_COUNTER' },
    });

    expect(response.status).toBe(201);
    // The seeded Monthly plan is ₹1499. Nothing the client sent decided that.
    expect(response.data?.amountPaise).toBe(149900);
  });

  it('rejects a smuggled amount rather than ignoring it (CLAUDE.md rule 2)', async () => {
    const response = await callFunction('create-payment-order', {
      as: SEED.neha,
      headers: { 'Idempotency-Key': uuid() },
      body: { planId: SEED.plans.monthly, method: 'CASH_COUNTER', amountPaise: 1 },
    });

    expect(response.status).toBe(400);
    expect(response.error?.code).toBe('VALIDATION_FAILED');
  });

  it('refuses a caller who is not a member of any gym', async () => {
    const response = await callFunction('create-payment-order', {
      as: SEED.outsider,
      headers: { 'Idempotency-Key': uuid() },
      body: { planId: SEED.plans.monthly, method: 'CASH_COUNTER' },
    });

    expect(response.status).toBe(403);
    expect(response.error?.code).toBe('NOT_GYM_MEMBER');
  });

  it('replaying an idempotency key returns the original order, not a second one', async () => {
    // The first call has to succeed for the replay to mean anything, and D-004
    // refuses a second pending membership.
    await clearPendingMembership(SEED.neha);

    const key = uuid();
    const body = { planId: SEED.plans.quarterly, method: 'CASH_COUNTER' as const };

    const first = await callFunction<{ paymentId: string }>('create-payment-order', {
      as: SEED.neha,
      headers: { 'Idempotency-Key': key },
      body,
    });
    const second = await callFunction<{ paymentId: string }>('create-payment-order', {
      as: SEED.neha,
      headers: { 'Idempotency-Key': key },
      body,
    });

    expect(first.data?.paymentId, JSON.stringify(first.error)).toBeDefined();
    expect(second.data?.paymentId).toBe(first.data?.paymentId);
  });

  it('refuses a second pending membership (D-004)', async () => {
    // Vikram already has a PENDING_PAYMENT membership from the seed.
    const response = await callFunction('create-payment-order', {
      as: SEED.vikram,
      headers: { 'Idempotency-Key': uuid() },
      body: { planId: SEED.plans.monthly, method: 'CASH_COUNTER' },
    });

    expect(response.status).toBe(409);
    expect(response.error?.code).toBe('MEMBERSHIP_ALREADY_PENDING');
  });

  it('requires an idempotency key', async () => {
    const response = await callFunction('create-payment-order', {
      as: SEED.priya,
      body: { planId: SEED.plans.monthly, method: 'CASH_COUNTER' },
    });

    expect(response.status).toBe(400);
  });
});

describe('razorpay-webhook', () => {
  const body = (orderId: string, amount: number, event = 'payment.captured') =>
    JSON.stringify({
      event,
      payload: { payment: { entity: { id: `pay_${uuid().slice(0, 8)}`, order_id: orderId, amount } } },
    });

  async function post(raw: string, signature: string | null, eventId?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (signature) headers['X-Razorpay-Signature'] = signature;
    if (eventId) headers['X-Razorpay-Event-Id'] = eventId;

    const response = await fetch(`${FUNCTIONS_URL}/razorpay-webhook`, {
      method: 'POST',
      headers: { apikey: process.env.SUPABASE_ANON_KEY ?? '', ...headers },
      body: raw,
    });
    return { status: response.status, json: await response.json() };
  }

  it('rejects an unsigned request', async () => {
    const raw = body('order_does_not_matter', 100);
    const response = await post(raw, null);

    expect(response.status).toBe(401);
    expect(response.json.error.code).toBe('WEBHOOK_SIGNATURE_INVALID');
  });

  it('rejects a wrong signature', async () => {
    const raw = body('order_does_not_matter', 100);
    const response = await post(raw, 'f'.repeat(64));

    expect(response.status).toBe(401);
    expect(response.json.error.code).toBe('WEBHOOK_SIGNATURE_INVALID');
  });

  it('returns 200 for an unhandled event so the provider does not retry', async () => {
    const raw = JSON.stringify({ event: 'subscription.charged' });
    const response = await post(raw, signWebhook(raw));

    expect(response.status).toBe(200);
    expect(response.json.data.handled).toBe(false);
  });

  it('returns 200 for an unknown order rather than making the provider retry', async () => {
    const raw = body('order_from_another_environment', 100);
    const response = await post(raw, signWebhook(raw));

    expect(response.status).toBe(200);
    expect(response.json.data.handled).toBe(false);
  });

  it('audits an amount mismatch and does NOT activate the membership', async () => {
    // Arrange: a fresh pending online payment with a known order id.
    const orderId = `order_test_${uuid().slice(0, 8)}`;
    const paymentId = await arrangePendingPayment({
      userId: SEED.imran,
      planId: SEED.plans.annual,
      amountPaise: 1299900,
      orderId,
    });

    // Act: a correctly signed event claiming ₹1 instead of ₹12,999.
    const raw = body(orderId, 1);
    const response = await post(raw, signWebhook(raw));

    expect(response.status).toBe(200);
    expect(response.json.data.reason).toBe('amount_mismatch');

    // Assert: still pending, and the mismatch is on the record.
    const [status] = await sql(`select status from public.payments where id = '${paymentId}';`);
    expect(status?.value).toBe('PENDING');

    const [audited] = await sql(`
      select count(*) from public.audit_logs
      where action = 'PAYMENT_AMOUNT_MISMATCH' and entity_id = '${paymentId}';
    `);
    expect(Number(audited?.value)).toBe(1);
  });

  it('activates on capture, and a replayed event id does not activate twice', async () => {
    const orderId = `order_test_${uuid().slice(0, 8)}`;
    const paymentId = await arrangePendingPayment({
      userId: SEED.priya,
      planId: SEED.plans.monthly,
      amountPaise: 149900,
      orderId,
    });

    const eventId = `evt_${uuid().slice(0, 8)}`;
    const raw = body(orderId, 149900);

    const first = await post(raw, signWebhook(raw), eventId);
    expect(first.status).toBe(200);
    expect(first.json.data.handled).toBe(true);

    const second = await post(raw, signWebhook(raw), eventId);
    expect(second.json.data.duplicate).toBe(true);

    const [paid] = await sql(`select status from public.payments where id = '${paymentId}';`);
    expect(paid?.value).toBe('PAID');

    // Exactly one activation, however many times the provider delivers.
    const [activations] = await sql(`
      select count(*) from public.audit_logs a
      join public.payments p on p.membership_id = a.entity_id
      where a.action = 'MEMBERSHIP_ACTIVATED' and p.id = '${paymentId}';
    `);
    expect(Number(activations?.value)).toBe(1);
  });
});
