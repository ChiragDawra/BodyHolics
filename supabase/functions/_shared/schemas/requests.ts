// GENERATED MIRROR — do not edit.
//
// Source: packages/validation/src/requests.ts (D-012).
// Deno cannot import a pnpm workspace package, so this is a copy. Edit the
// source and run `pnpm test:shared-parity --write`; CI fails if the two drift.

// Request schemas for every Edge Function in docs/07.
//
// Two rules govern every shape in this file and both are security properties,
// not style choices:
//
//   1. `.strict()` everywhere. An unknown key is a rejected request, not a
//      silently ignored one — that is what stops a caller smuggling `gym_id`,
//      `amount_paise`, `status`, or `role` past a schema that forgot them.
//   2. No field here carries money, identity, tenancy, or authority. Prices come
//      from `membership_plans` (CLAUDE.md rule 2), the phone comes from the JWT,
//      and `gym_id` is resolved server-side from gym_members/gym_staff. The one
//      documented exception is `gymSlug` at onboarding, before a membership
//      exists to resolve from (D-006).
//
// Mirrored for Deno in supabase/functions/_shared/schemas/ (D-012).
import { z } from 'zod';
import {
  gymSlugSchema,
  idempotencyKeySchema,
  isoDateSchema,
  isoDateTimeSchema,
  localTimeSchema,
  safeText,
  uuidSchema,
  weekdaySchema,
} from './common.ts';

// --- Onboarding -------------------------------------------------------------

/** docs/07 §3. `phone` is deliberately absent: it is read from the JWT. */
export const createMemberProfileSchema = z
  .object({
    gymSlug: gymSlugSchema,
    fullName: safeText(2, 120),
    dateOfBirth: isoDateSchema.optional(),
  })
  .strict();
export type CreateMemberProfileRequest = z.infer<typeof createMemberProfileSchema>;

export const gymBySlugQuerySchema = z.object({ slug: gymSlugSchema }).strict();

// --- Payments ---------------------------------------------------------------

export const paymentMethodSchema = z.enum(['ONLINE', 'UPI_COUNTER', 'CASH_COUNTER']);

/**
 * docs/07 §4. There is no `amountPaise` field and there never will be: the
 * server loads `membership_plans.price_paise` for the referenced plan.
 */
export const createPaymentOrderSchema = z
  .object({
    planId: uuidSchema,
    method: paymentMethodSchema,
  })
  .strict();
export type CreatePaymentOrderRequest = z.infer<typeof createPaymentOrderSchema>;

export const paymentStatusQuerySchema = z.object({ paymentId: uuidSchema }).strict();

/** docs/07 §4. Staff scans the member's short-lived QR; the token is the proof. */
export const confirmCounterPaymentSchema = z
  .object({
    memberQrToken: z.string().min(16).max(256),
    method: z.enum(['UPI_COUNTER', 'CASH_COUNTER']),
  })
  .strict();
export type ConfirmCounterPaymentRequest = z.infer<typeof confirmCounterPaymentSchema>;

/** Header schema for the two functions that require an idempotency key. */
export const idempotentHeadersSchema = z
  .object({ 'idempotency-key': idempotencyKeySchema })
  .loose();

// --- Member QR --------------------------------------------------------------

export const createQrTokenSchema = z
  .object({
    purpose: z.enum(['COUNTER_PAYMENT', 'MEMBER_LOOKUP']),
    paymentId: uuidSchema.optional(),
  })
  .strict()
  .refine((value) => value.purpose !== 'COUNTER_PAYMENT' || value.paymentId !== undefined, {
    message: 'paymentId is required for a counter-payment token.',
    path: ['paymentId'],
  });
export type CreateQrTokenRequest = z.infer<typeof createQrTokenSchema>;

// --- Gym status -------------------------------------------------------------

export const currentGymStatusQuerySchema = z.object({ gymId: uuidSchema }).strict();

/**
 * docs/07 §5. `gymId` is absent — staff authority is resolved from `gym_staff`,
 * so a staff member of gym A cannot address gym B by passing its id.
 */
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const overrideGymStatusSchema = z
  .object({
    status: z.enum(['OPEN', 'CLOSED']),
    startsAt: isoDateTimeSchema.optional(),
    endsAt: isoDateTimeSchema,
    reason: safeText(3, 200).optional(),
    notifyMembers: z.boolean().default(false),
  })
  .strict()
  .refine((value) => Date.parse(value.endsAt) > Date.parse(value.startsAt ?? new Date().toISOString()), {
    message: 'The end time must be after the start time.',
    path: ['endsAt'],
  })
  .refine(
    (value) =>
      Date.parse(value.endsAt) - Date.parse(value.startsAt ?? new Date().toISOString()) <=
      THIRTY_DAYS_MS,
    {
      // docs/07 §5 — an unbounded override would silently outlive the reason for it.
      message: 'An override may not last longer than 30 days.',
      path: ['endsAt'],
    },
  );
export type OverrideGymStatusRequest = z.infer<typeof overrideGymStatusSchema>;

export const gymHoursRowSchema = z
  .object({
    weekday: weekdaySchema,
    isClosed: z.boolean(),
    opensAt: localTimeSchema.nullable(),
    closesAt: localTimeSchema.nullable(),
  })
  .strict()
  .refine(
    (row) => row.isClosed || (row.opensAt !== null && row.closesAt !== null && row.closesAt > row.opensAt),
    {
      // Q5: same-day windows only. An overnight span is rejected here rather
      // than silently wrapping at midnight.
      message: 'An open day needs an opening and a later closing time.',
      path: ['closesAt'],
    },
  );

export const updateGymHoursSchema = z
  .object({ hours: z.array(gymHoursRowSchema).length(7) })
  .strict()
  .refine((value) => new Set(value.hours.map((row) => row.weekday)).size === 7, {
    message: 'Provide exactly one row per weekday.',
    path: ['hours'],
  });

// --- Broadcasts -------------------------------------------------------------

export const broadcastAudienceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ALL_MEMBERS') }).strict(),
  z.object({ type: z.literal('ACTIVE_MEMBERS') }).strict(),
  z.object({ type: z.literal('EXPIRING_MEMBERS') }).strict(),
  z.object({ type: z.literal('INACTIVE_MEMBERS') }).strict(),
  z
    .object({
      type: z.literal('SELECTED_MEMBERS'),
      // Each id is re-validated server-side to belong to the caller's gym.
      userIds: z.array(uuidSchema).min(1).max(500),
    })
    .strict(),
]);

export const broadcastCategorySchema = z.enum([
  'HOLIDAY',
  'MAINTENANCE',
  'LOST_AND_FOUND',
  'EQUIPMENT',
  'EVENT',
  'GENERAL',
]);

/**
 * docs/07 §6. Either publish an existing DRAFT/SCHEDULED by id, or create and
 * publish in one call — in which case title, body, category and audience are all
 * required. `recipientCount` is server-computed and has no field here.
 */
export const publishBroadcastSchema = z
  .object({
    broadcastId: uuidSchema.optional(),
    title: safeText(3, 120).optional(),
    body: safeText(1, 2000).optional(),
    category: broadcastCategorySchema.optional(),
    audience: broadcastAudienceSchema.optional(),
    publishAt: isoDateTimeSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.broadcastId !== undefined ||
      (value.title !== undefined &&
        value.body !== undefined &&
        value.category !== undefined &&
        value.audience !== undefined),
    {
      message: 'Provide a broadcastId, or a full title, body, category and audience.',
      path: ['broadcastId'],
    },
  );
export type PublishBroadcastRequest = z.infer<typeof publishBroadcastSchema>;

// --- Issues -----------------------------------------------------------------

export const issueCategorySchema = z.enum([
  'EQUIPMENT',
  'CLEANLINESS',
  'STAFF',
  'BILLING',
  'SAFETY',
  'OTHER',
]);

export const createIssueSchema = z
  .object({
    category: issueCategorySchema,
    title: safeText(3, 120),
    description: safeText(10, 2000),
    // Storage paths of already-uploaded attachments, max 3 (docs/01 §5.7).
    attachmentPaths: z.array(z.string().min(1).max(512)).max(3).default([]),
  })
  .strict();
export type CreateIssueRequest = z.infer<typeof createIssueSchema>;

export const replyToIssueSchema = z
  .object({
    issueId: uuidSchema,
    body: safeText(1, 2000),
  })
  .strict();
export type ReplyToIssueRequest = z.infer<typeof replyToIssueSchema>;

export const updateIssueStatusSchema = z
  .object({
    issueId: uuidSchema,
    status: z.enum(['IN_PROGRESS', 'RESOLVED', 'CLOSED']),
    message: safeText(1, 2000).optional(),
  })
  .strict()
  .refine((value) => value.status !== 'CLOSED' || value.message !== undefined, {
    // docs/09 §4 — closing an issue requires a closing message.
    message: 'A closing message is required.',
    path: ['message'],
  });
export type UpdateIssueStatusRequest = z.infer<typeof updateIssueStatusSchema>;

// --- Attendance & crowd -----------------------------------------------------

/**
 * docs/07 §8. `occurredAt` is absent on purpose — the server timestamps the
 * event, so a client cannot backdate a visit to inflate a streak.
 */
export const attendanceEventSchema = z
  .object({
    eventType: z.enum(['PRESENCE_START', 'PRESENCE_END']),
  })
  .strict();
export type AttendanceEventRequest = z.infer<typeof attendanceEventSchema>;

export const currentCrowdQuerySchema = z.object({ gymId: uuidSchema }).strict();

// --- Admin: plans -----------------------------------------------------------

/**
 * Price is entered by an OWNER here, which is the one place a price legitimately
 * enters the system from a client. It is still bounded, integer paise, and this
 * endpoint is OWNER-only (docs/01 §2).
 */
export const createPlanSchema = z
  .object({
    name: safeText(2, 80),
    description: safeText(1, 500).optional(),
    pricePaise: z.int().min(0).max(100_000_000),
    durationDays: z.int().min(1).max(3650),
    sortOrder: z.int().min(0).max(999).default(0),
  })
  .strict();
export type CreatePlanRequest = z.infer<typeof createPlanSchema>;

/**
 * Editing the price of a plan that has sales creates a new plan version instead
 * of repricing history (docs/01 §6.3), so price is not editable here.
 */
export const updatePlanSchema = z
  .object({
    planId: uuidSchema,
    name: safeText(2, 80).optional(),
    description: safeText(1, 500).optional(),
    sortOrder: z.int().min(0).max(999).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
export type UpdatePlanRequest = z.infer<typeof updatePlanSchema>;
