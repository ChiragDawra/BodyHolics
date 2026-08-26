// GENERATED MIRROR — do not edit.
//
// Source: packages/domain/src/types.ts (D-012).
// Deno cannot import a pnpm workspace package, so this is a copy. Edit the
// source and run `pnpm test:shared-parity --write`; CI fails if the two drift.

// Shared DTOs. These are hand-written and stable; the generated row types live
// in @gym/types (packages/types/src/database.ts) and are never edited by hand.
import type { CrowdLevel } from './crowd.ts';
import type { GymStatus, GymStatusSource } from './gym-status.ts';
import type { BroadcastStatus } from './state/broadcast.ts';
import type { IssueStatus } from './state/issue.ts';
import type { MembershipStatus } from './state/membership.ts';
import type { PaymentStatus } from './state/payment.ts';

export interface Gym {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  logoUrl: string | null;
  expiryWarningDays: number;
}

export interface MembershipPlan {
  id: string;
  name: string;
  description: string | null;
  pricePaise: number;
  durationDays: number;
  isActive: boolean;
  sortOrder: number;
}

export interface Membership {
  id: string;
  planId: string;
  planName: string | null;
  status: MembershipStatus;
  startAt: Date | null;
  endAt: Date | null;
  daysRemaining: number | null;
  isExpiring: boolean;
}

// Must match the payments.method check constraint (docs/05 line 249).
export const PAYMENT_METHODS = ['ONLINE', 'UPI_COUNTER', 'CASH_COUNTER', 'OTHER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** The two methods a member settles at the counter, requiring staff confirmation. */
export const COUNTER_PAYMENT_METHODS = ['UPI_COUNTER', 'CASH_COUNTER'] as const;

export interface Payment {
  id: string;
  amountPaise: number;
  status: PaymentStatus;
  method: PaymentMethod;
  createdAt: Date;
  paidAt: Date | null;
}

export interface GymStatusSnapshot {
  status: GymStatus;
  source: GymStatusSource;
  reason: string | null;
  until: string | null;
}

export interface CrowdSnapshot {
  level: CrowdLevel;
  capturedAt: Date;
}

export interface Issue {
  id: string;
  title: string;
  category: string;
  status: IssueStatus;
  createdAt: Date;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
}

export interface Broadcast {
  id: string;
  title: string;
  body: string;
  status: BroadcastStatus;
  publishAt: Date | null;
  publishedAt: Date | null;
  recipientCount: number;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  category: string;
  createdAt: Date;
  readAt: Date | null;
}
