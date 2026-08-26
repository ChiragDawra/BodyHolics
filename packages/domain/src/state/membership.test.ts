import { describe, expect, it } from 'vitest';
import {
  MEMBERSHIP_STATUSES,
  canTransition,
  isMembershipStatus,
  isTerminal,
} from './membership';
import type { MembershipStatus } from './membership';

const ALLOWED: ReadonlyArray<[MembershipStatus, MembershipStatus]> = [
  ['PENDING_PAYMENT', 'ACTIVE'],
  ['PENDING_PAYMENT', 'CANCELLED'],
  ['ACTIVE', 'EXPIRED'],
  ['ACTIVE', 'CANCELLED'],
];

describe('membership state machine (docs/09 §2)', () => {
  it.each(ALLOWED)('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to).ok).toBe(true);
  });

  it('rejects every transition not in the table', () => {
    const allowed = new Set(ALLOWED.map(([from, to]) => `${from}>${to}`));
    for (const from of MEMBERSHIP_STATUSES) {
      for (const to of MEMBERSHIP_STATUSES) {
        if (from === to || allowed.has(`${from}>${to}`)) continue;
        const result = canTransition(from, to);
        expect(result.ok, `${from} -> ${to} should be rejected`).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('INVALID_MEMBERSHIP_TRANSITION');
      }
    }
  });

  it('makes a second activation of the same payment a no-op', () => {
    expect(canTransition('ACTIVE', 'ACTIVE').ok).toBe(true);
  });

  it('never revives an EXPIRED membership — renewal is a new row (D-004)', () => {
    expect(canTransition('EXPIRED', 'ACTIVE').ok).toBe(false);
    expect(isTerminal('EXPIRED')).toBe(true);
    expect(isTerminal('CANCELLED')).toBe(true);
    expect(isTerminal('ACTIVE')).toBe(false);
    expect(isTerminal('PENDING_PAYMENT')).toBe(false);
  });

  it('narrows unknown values', () => {
    expect(isMembershipStatus('ACTIVE')).toBe(true);
    expect(isMembershipStatus('EXPIRING')).toBe(false); // derived, never stored
    expect(isMembershipStatus(null)).toBe(false);
  });
});
