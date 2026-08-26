// GENERATED MIRROR — do not edit.
//
// Source: packages/domain/src/state/issue.ts (D-012).
// Deno cannot import a pnpm workspace package, so this is a copy. Edit the
// source and run `pnpm test:shared-parity --write`; CI fails if the two drift.

// docs/09 §4 — Issue. D-003 owns the status labels.
import { allow, deny, type Result, type TransitionError } from '../errors.ts';

export const ISSUE_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export type IssueActor = 'MEMBER' | 'STAFF' | 'SYSTEM';

export interface IssueTransitionContext {
  actor: IssueActor;
  /** Whole days since `resolved_at`; only meaningful when leaving RESOLVED. */
  daysSinceResolved?: number;
}

/** Member-facing wording for each status (D-003). */
export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'Owner reviewing',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

const REOPEN_WINDOW_DAYS = 7;

export function isIssueStatus(value: unknown): value is IssueStatus {
  return typeof value === 'string' && (ISSUE_STATUSES as readonly string[]).includes(value);
}

export function canTransition(
  from: IssueStatus,
  to: IssueStatus,
  ctx: IssueTransitionContext,
): Result<void, TransitionError> {
  if (from === to) return allow();
  if (from === 'CLOSED') return deny('ISSUE_CLOSED', from, to);

  switch (`${from}>${to}`) {
    case 'OPEN>IN_PROGRESS':
    case 'OPEN>CLOSED':
    case 'IN_PROGRESS>RESOLVED':
      return ctx.actor === 'STAFF' ? allow() : deny('FORBIDDEN', from, to);

    case 'RESOLVED>IN_PROGRESS': {
      // Staff may reopen at any time; a member only within the 7-day window.
      if (ctx.actor === 'STAFF') return allow();
      if (ctx.actor !== 'MEMBER') return deny('FORBIDDEN', from, to);
      const days = ctx.daysSinceResolved ?? Number.POSITIVE_INFINITY;
      return days <= REOPEN_WINDOW_DAYS ? allow() : deny('INVALID_ISSUE_TRANSITION', from, to);
    }

    case 'RESOLVED>CLOSED':
      // Every actor may close a resolved issue: the 7-day auto-close cron
      // (SYSTEM), the member confirming, and staff closing it out.
      return allow();

    default:
      return deny('INVALID_ISSUE_TRANSITION', from, to);
  }
}

export function isTerminal(status: IssueStatus): boolean {
  return status === 'CLOSED';
}
