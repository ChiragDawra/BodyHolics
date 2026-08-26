// docs/09 §5 — Broadcast. PUBLISHED is terminal and immutable.
import { allow, deny, type Result, type TransitionError } from '../errors';

export const BROADCAST_STATUSES = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'CANCELLED'] as const;
export type BroadcastStatus = (typeof BROADCAST_STATUSES)[number];

export const BROADCAST_AUDIENCE_TYPES = [
  'ALL_MEMBERS',
  'ACTIVE_MEMBERS',
  'EXPIRING_MEMBERS',
  'INACTIVE_MEMBERS',
  'SELECTED_MEMBERS',
] as const;
export type BroadcastAudienceType = (typeof BROADCAST_AUDIENCE_TYPES)[number];

export type BroadcastActor = 'STAFF' | 'SYSTEM';

export interface BroadcastTransitionContext {
  actor: BroadcastActor;
  /** Required when scheduling: must be in the future. */
  publishAt?: Date;
  now?: Date;
}

export function isBroadcastStatus(value: unknown): value is BroadcastStatus {
  return typeof value === 'string' && (BROADCAST_STATUSES as readonly string[]).includes(value);
}

export function canTransition(
  from: BroadcastStatus,
  to: BroadcastStatus,
  ctx: BroadcastTransitionContext,
): Result<void, TransitionError> {
  if (from === 'PUBLISHED') return deny('BROADCAST_IMMUTABLE', from, to);
  if (from === to) return allow();
  if (from === 'CANCELLED') return deny('BROADCAST_IMMUTABLE', from, to);

  const now = ctx.now ?? new Date();

  switch (`${from}>${to}`) {
    case 'DRAFT>SCHEDULED': {
      if (ctx.actor !== 'STAFF') return deny('FORBIDDEN', from, to);
      if (!ctx.publishAt || ctx.publishAt.getTime() <= now.getTime()) {
        return deny('VALIDATION_FAILED', from, to);
      }
      return allow();
    }
    case 'DRAFT>PUBLISHED':
    case 'SCHEDULED>CANCELLED':
    case 'SCHEDULED>DRAFT':
      return ctx.actor === 'STAFF' ? allow() : deny('FORBIDDEN', from, to);

    case 'SCHEDULED>PUBLISHED':
      // Only the cron publishes a scheduled broadcast, at publish_at.
      return ctx.actor === 'SYSTEM' ? allow() : deny('FORBIDDEN', from, to);

    default:
      return deny('VALIDATION_FAILED', from, to);
  }
}
