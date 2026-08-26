import { describe, expect, it } from 'vitest';
import {
  attendanceEventSchema,
  confirmCounterPaymentSchema,
  createIssueSchema,
  createMemberProfileSchema,
  createPaymentOrderSchema,
  createPlanSchema,
  createQrTokenSchema,
  gymHoursRowSchema,
  overrideGymStatusSchema,
  publishBroadcastSchema,
  replyToIssueSchema,
  updateGymHoursSchema,
  updateIssueStatusSchema,
  updatePlanSchema,
} from './requests';
import { isoDateSchema, noFormulaPrefix } from './common';

const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const OTHER_UUID = '9c858901-8a57-4791-81fe-4c455b099bc9';
const iso = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString();
const DAY = 86_400_000;

describe('request schemas reject smuggled privileged fields', () => {
  // The point of .strict() - each of these keys would be a privilege escalation
  // if it were silently ignored instead of rejected.
  it('rejects a client-supplied amount on a payment order (CLAUDE.md rule 2)', () => {
    expect(
      createPaymentOrderSchema.safeParse({ planId: UUID, method: 'ONLINE', amountPaise: 1 }).success,
    ).toBe(false);
    expect(createPaymentOrderSchema.safeParse({ planId: UUID, method: 'ONLINE' }).success).toBe(
      true,
    );
  });

  it('rejects a client-supplied phone on profile creation (docs/07 section 3)', () => {
    expect(
      createMemberProfileSchema.safeParse({
        gymSlug: 'urban-gym',
        fullName: 'Asha Rao',
        phone: '+919876543210',
      }).success,
    ).toBe(false);
  });

  it('rejects a client-supplied gymId where tenancy is resolved server-side', () => {
    expect(
      overrideGymStatusSchema.safeParse({ status: 'CLOSED', endsAt: iso(DAY), gymId: UUID }).success,
    ).toBe(false);
    expect(
      createIssueSchema.safeParse({
        category: 'EQUIPMENT',
        title: 'Broken bench',
        description: 'The flat bench in the corner is wobbling badly.',
        gymId: UUID,
      }).success,
    ).toBe(false);
  });

  it('rejects a client-supplied status or role', () => {
    expect(
      createMemberProfileSchema.safeParse({ gymSlug: 'g1', fullName: 'Asha Rao', role: 'OWNER' })
        .success,
    ).toBe(false);
    expect(
      createPaymentOrderSchema.safeParse({ planId: UUID, method: 'ONLINE', status: 'PAID' }).success,
    ).toBe(false);
  });

  it('rejects repricing a sold plan through the update endpoint (docs/01 section 6.3)', () => {
    expect(updatePlanSchema.safeParse({ planId: UUID, pricePaise: 0 }).success).toBe(false);
    expect(updatePlanSchema.safeParse({ planId: UUID, name: 'Quarterly' }).success).toBe(true);
  });

  it('rejects a backdated attendance event', () => {
    expect(
      attendanceEventSchema.safeParse({ eventType: 'PRESENCE_START', occurredAt: iso(-DAY) })
        .success,
    ).toBe(false);
  });

  it('rejects a payment id on counter confirmation - the QR token is the authorization', () => {
    expect(
      confirmCounterPaymentSchema.safeParse({
        memberQrToken: 'a'.repeat(43),
        method: 'CASH_COUNTER',
        paymentId: UUID,
      }).success,
    ).toBe(false);
  });
});

describe('common primitives', () => {
  it('flags CSV cells that a spreadsheet would execute as a formula', () => {
    // The admin payment export contains member-supplied names. A cell starting
    // with any of these is run as a formula by Excel and Sheets, so the export
    // writer prefixes such a cell rather than emitting it raw.
    for (const hostile of ['=1+1', '+1', '-1', '@SUM(A1)', '\tcmd', '\rcmd']) {
      expect(noFormulaPrefix(hostile), JSON.stringify(hostile)).toBe(false);
    }
    for (const safe of ['Asha Rao', '1200', 'PAID', "O'Brien"]) {
      expect(noFormulaPrefix(safe), safe).toBe(true);
    }
  });

  it('rejects a well-shaped date that is not a real calendar day', () => {
    expect(isoDateSchema.safeParse('1994-02-28').success).toBe(true);
    expect(isoDateSchema.safeParse('1994-02-30').success).toBe(false);
    expect(isoDateSchema.safeParse('1994-13-01').success).toBe(false);
    expect(isoDateSchema.safeParse('1994-2-8').success).toBe(false);
  });

  it('rejects control characters in free text', () => {
    // An escape sequence stored in a name reaches an admin terminal and a CSV
    // export, so it is refused at the boundary rather than escaped downstream.
    // Built from char codes so the hostile bytes never sit in this source file.
    const ch = (code: number) => String.fromCharCode(code);
    const hostile = [
      `Asha${ch(0)}Rao`,
      `Asha${ch(27)}[31mRao`,
      `Asha${ch(10)}Rao`,
      `Asha${ch(9)}Rao`,
      `Asha${ch(133)}Rao`,
    ];
    for (const fullName of hostile) {
      expect(
        createMemberProfileSchema.safeParse({ gymSlug: 'urban-gym', fullName }).success,
        JSON.stringify(fullName),
      ).toBe(false);
    }
    expect(
      createMemberProfileSchema.safeParse({ gymSlug: 'urban-gym', fullName: 'Asha Rao' }).success,
    ).toBe(true);
  });

  it('constrains a gym slug to the shape the DB check allows', () => {
    const ok = (slug: string) =>
      createMemberProfileSchema.safeParse({ gymSlug: slug, fullName: 'Asha Rao' }).success;
    expect(ok('urban-gym')).toBe(true);
    expect(ok('Urban-Gym')).toBe(false);
    expect(ok('urban_gym')).toBe(false);
    expect(ok('-urban')).toBe(false);
    expect(ok('urban--gym')).toBe(false);
    expect(ok('u')).toBe(false);
  });

  it('trims and bounds a name', () => {
    const parsed = createMemberProfileSchema.safeParse({
      gymSlug: 'urban-gym',
      fullName: '  Asha Rao  ',
    });
    expect(parsed.success && parsed.data.fullName).toBe('Asha Rao');
    expect(createMemberProfileSchema.safeParse({ gymSlug: 'urban-gym', fullName: 'A' }).success).toBe(
      false,
    );
    expect(
      createMemberProfileSchema.safeParse({ gymSlug: 'urban-gym', fullName: 'A'.repeat(121) })
        .success,
    ).toBe(false);
  });

  it('requires a real ISO date for date of birth', () => {
    const withDob = (dateOfBirth: string) =>
      createMemberProfileSchema.safeParse({
        gymSlug: 'urban-gym',
        fullName: 'Asha Rao',
        dateOfBirth,
      }).success;
    expect(withDob('1996-04-21')).toBe(true);
    expect(withDob('21-04-1996')).toBe(false);
    expect(withDob('1996-13-01')).toBe(false);
  });
});

describe('payments', () => {
  it('accepts only the three member-selectable methods', () => {
    for (const method of ['ONLINE', 'UPI_COUNTER', 'CASH_COUNTER']) {
      expect(createPaymentOrderSchema.safeParse({ planId: UUID, method }).success, method).toBe(
        true,
      );
    }
    // OTHER exists in the DB for imported history, not as a client choice.
    expect(createPaymentOrderSchema.safeParse({ planId: UUID, method: 'OTHER' }).success).toBe(
      false,
    );
  });

  it('requires a plan id that is actually a uuid', () => {
    expect(createPaymentOrderSchema.safeParse({ planId: 'plan-1', method: 'ONLINE' }).success).toBe(
      false,
    );
  });

  it('accepts only counter methods on confirmation', () => {
    const memberQrToken = 'a'.repeat(43);
    expect(
      confirmCounterPaymentSchema.safeParse({ memberQrToken, method: 'UPI_COUNTER' }).success,
    ).toBe(true);
    expect(confirmCounterPaymentSchema.safeParse({ memberQrToken, method: 'ONLINE' }).success).toBe(
      false,
    );
  });

  it('rejects a token too short to be 32 random bytes', () => {
    expect(
      confirmCounterPaymentSchema.safeParse({ memberQrToken: 'short', method: 'CASH_COUNTER' })
        .success,
    ).toBe(false);
  });
});

describe('QR tokens', () => {
  it('requires a payment id for a counter-payment token', () => {
    expect(createQrTokenSchema.safeParse({ purpose: 'COUNTER_PAYMENT' }).success).toBe(false);
    expect(
      createQrTokenSchema.safeParse({ purpose: 'COUNTER_PAYMENT', paymentId: UUID }).success,
    ).toBe(true);
  });

  it('allows a lookup token with no payment attached', () => {
    expect(createQrTokenSchema.safeParse({ purpose: 'MEMBER_LOOKUP' }).success).toBe(true);
  });

  it('rejects an unknown purpose', () => {
    expect(createQrTokenSchema.safeParse({ purpose: 'DOOR_ACCESS' }).success).toBe(false);
  });
});

describe('gym status and hours', () => {
  it('requires the override window to be ordered and bounded', () => {
    expect(overrideGymStatusSchema.safeParse({ status: 'CLOSED', endsAt: iso(DAY) }).success).toBe(
      true,
    );
    expect(
      overrideGymStatusSchema.safeParse({
        status: 'CLOSED',
        startsAt: iso(2 * DAY),
        endsAt: iso(DAY),
      }).success,
    ).toBe(false);
    expect(
      overrideGymStatusSchema.safeParse({ status: 'CLOSED', endsAt: iso(31 * DAY) }).success,
    ).toBe(false);
  });

  it('defaults notifyMembers to false so a broadcast is never sent by accident', () => {
    const parsed = overrideGymStatusSchema.safeParse({ status: 'OPEN', endsAt: iso(DAY) });
    expect(parsed.success && parsed.data.notifyMembers).toBe(false);
  });

  it('rejects an overnight window (Q5) and a closed day with times', () => {
    const row = (over: Record<string, unknown>) =>
      gymHoursRowSchema.safeParse({
        weekday: 1,
        isClosed: false,
        opensAt: '06:00',
        closesAt: '22:00',
        ...over,
      }).success;
    expect(row({})).toBe(true);
    expect(row({ opensAt: '22:00', closesAt: '06:00' })).toBe(false);
    expect(row({ opensAt: '06:00', closesAt: '06:00' })).toBe(false);
    expect(row({ isClosed: true, opensAt: null, closesAt: null })).toBe(true);
    expect(row({ opensAt: null })).toBe(false);
    expect(row({ closesAt: '24:00' })).toBe(false);
    expect(row({ weekday: 7 })).toBe(false);
  });

  it('requires exactly one row per weekday', () => {
    const open = (weekday: number) => ({
      weekday,
      isClosed: false,
      opensAt: '06:00',
      closesAt: '22:00',
    });
    const week = [0, 1, 2, 3, 4, 5, 6].map(open);
    expect(updateGymHoursSchema.safeParse({ hours: week }).success).toBe(true);
    expect(updateGymHoursSchema.safeParse({ hours: week.slice(0, 6) }).success).toBe(false);
    // Seven rows, but Monday twice and Sunday missing.
    expect(updateGymHoursSchema.safeParse({ hours: [...week.slice(1), open(1)] }).success).toBe(
      false,
    );
  });
});

describe('broadcasts', () => {
  const audience = { type: 'ACTIVE_MEMBERS' as const };
  const draft = {
    title: 'Holiday hours',
    body: 'We close at 2pm on Friday.',
    category: 'HOLIDAY' as const,
    audience,
  };

  it('accepts create-and-publish or publish-by-id, but not an empty call', () => {
    expect(publishBroadcastSchema.safeParse(draft).success).toBe(true);
    expect(publishBroadcastSchema.safeParse({ broadcastId: UUID }).success).toBe(true);
    expect(publishBroadcastSchema.safeParse({ title: 'Holiday hours' }).success).toBe(false);
  });

  it('accepts only the six categories the DB check allows', () => {
    for (const category of [
      'HOLIDAY',
      'MAINTENANCE',
      'LOST_AND_FOUND',
      'EQUIPMENT',
      'EVENT',
      'GENERAL',
    ]) {
      expect(publishBroadcastSchema.safeParse({ ...draft, category }).success, category).toBe(true);
    }
    expect(publishBroadcastSchema.safeParse({ ...draft, category: 'OFFER' }).success).toBe(false);
  });

  it('takes a recipient list only for SELECTED_MEMBERS', () => {
    // For rule-based audiences the server evaluates the rule; a client list here
    // would be a way to address members of another gym.
    expect(
      publishBroadcastSchema.safeParse({
        ...draft,
        audience: { type: 'ACTIVE_MEMBERS', userIds: [UUID] },
      }).success,
    ).toBe(false);
    expect(
      publishBroadcastSchema.safeParse({
        ...draft,
        audience: { type: 'SELECTED_MEMBERS', userIds: [UUID, OTHER_UUID] },
      }).success,
    ).toBe(true);
    expect(
      publishBroadcastSchema.safeParse({
        ...draft,
        audience: { type: 'SELECTED_MEMBERS', userIds: [] },
      }).success,
    ).toBe(false);
    expect(
      publishBroadcastSchema.safeParse({
        ...draft,
        audience: { type: 'SELECTED_MEMBERS', userIds: Array<string>(501).fill(UUID) },
      }).success,
    ).toBe(false);
  });
});

describe('issues', () => {
  const issue = {
    category: 'EQUIPMENT' as const,
    title: 'Broken bench',
    description: 'The flat bench in the corner is wobbling badly.',
  };

  it('accepts the six categories the DB check allows, including SAFETY', () => {
    for (const category of ['EQUIPMENT', 'CLEANLINESS', 'STAFF', 'BILLING', 'SAFETY', 'OTHER']) {
      expect(createIssueSchema.safeParse({ ...issue, category }).success, category).toBe(true);
    }
    expect(createIssueSchema.safeParse({ ...issue, category: 'REFUND' }).success).toBe(false);
  });

  it('caps attachments at three and defaults to none', () => {
    const parsed = createIssueSchema.safeParse(issue);
    expect(parsed.success && parsed.data.attachmentPaths).toEqual([]);
    expect(createIssueSchema.safeParse({ ...issue, attachmentPaths: ['a', 'b', 'c'] }).success).toBe(
      true,
    );
    expect(
      createIssueSchema.safeParse({ ...issue, attachmentPaths: ['a', 'b', 'c', 'd'] }).success,
    ).toBe(false);
  });

  it('bounds the description', () => {
    expect(createIssueSchema.safeParse({ ...issue, description: 'too short' }).success).toBe(false);
    expect(createIssueSchema.safeParse({ ...issue, description: 'x'.repeat(2001) }).success).toBe(
      false,
    );
  });

  it('requires a closing message but not otherwise', () => {
    expect(updateIssueStatusSchema.safeParse({ issueId: UUID, status: 'CLOSED' }).success).toBe(
      false,
    );
    expect(
      updateIssueStatusSchema.safeParse({ issueId: UUID, status: 'CLOSED', message: 'Fixed.' })
        .success,
    ).toBe(true);
    expect(updateIssueStatusSchema.safeParse({ issueId: UUID, status: 'RESOLVED' }).success).toBe(
      true,
    );
  });

  it('does not let staff push an issue back to OPEN (docs/09 section 4)', () => {
    expect(updateIssueStatusSchema.safeParse({ issueId: UUID, status: 'OPEN' }).success).toBe(false);
  });

  it('rejects an empty reply', () => {
    expect(replyToIssueSchema.safeParse({ issueId: UUID, body: '   ' }).success).toBe(false);
    expect(replyToIssueSchema.safeParse({ issueId: UUID, body: 'Thanks.' }).success).toBe(true);
  });
});

describe('attendance', () => {
  it('exposes only the two presence events to a member (docs/07 section 8)', () => {
    expect(attendanceEventSchema.safeParse({ eventType: 'PRESENCE_START' }).success).toBe(true);
    expect(attendanceEventSchema.safeParse({ eventType: 'PRESENCE_END' }).success).toBe(true);
    expect(attendanceEventSchema.safeParse({ eventType: 'CHECK_IN' }).success).toBe(false);
  });
});

describe('plans', () => {
  const plan = { name: 'Monthly', pricePaise: 150_000, durationDays: 30 };

  it('requires integer paise within a sane range', () => {
    expect(createPlanSchema.safeParse(plan).success).toBe(true);
    expect(createPlanSchema.safeParse({ ...plan, pricePaise: 1500.5 }).success).toBe(false);
    expect(createPlanSchema.safeParse({ ...plan, pricePaise: -1 }).success).toBe(false);
    expect(createPlanSchema.safeParse({ ...plan, pricePaise: 100_000_001 }).success).toBe(false);
  });

  it('requires a duration the activation function can turn into an interval', () => {
    expect(createPlanSchema.safeParse({ ...plan, durationDays: 0 }).success).toBe(false);
    expect(createPlanSchema.safeParse({ ...plan, durationDays: 30.5 }).success).toBe(false);
    expect(createPlanSchema.safeParse({ ...plan, durationDays: 3651 }).success).toBe(false);
  });
});
