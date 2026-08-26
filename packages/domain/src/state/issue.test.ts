import { describe, expect, it } from 'vitest';
import { ISSUE_STATUSES, ISSUE_STATUS_LABELS, canTransition, isIssueStatus, isTerminal } from './issue';

const staff = { actor: 'STAFF' } as const;
const member = { actor: 'MEMBER' } as const;
const system = { actor: 'SYSTEM' } as const;

describe('issue state machine (docs/09 §4)', () => {
  it('lets staff walk the happy path', () => {
    expect(canTransition('OPEN', 'IN_PROGRESS', staff).ok).toBe(true);
    expect(canTransition('IN_PROGRESS', 'RESOLVED', staff).ok).toBe(true);
    expect(canTransition('RESOLVED', 'CLOSED', staff).ok).toBe(true);
  });

  it('lets staff close an OPEN issue as duplicate/invalid', () => {
    expect(canTransition('OPEN', 'CLOSED', staff).ok).toBe(true);
  });

  it('refuses staff-only transitions to a member', () => {
    for (const pair of [
      ['OPEN', 'IN_PROGRESS'],
      ['OPEN', 'CLOSED'],
      ['IN_PROGRESS', 'RESOLVED'],
    ] as const) {
      const result = canTransition(pair[0], pair[1], member);
      expect(result.ok, `${pair[0]} -> ${pair[1]} by member`).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
    }
  });

  it('lets a member reopen within 7 days and refuses after', () => {
    expect(canTransition('RESOLVED', 'IN_PROGRESS', { actor: 'MEMBER', daysSinceResolved: 0 }).ok).toBe(true);
    expect(canTransition('RESOLVED', 'IN_PROGRESS', { actor: 'MEMBER', daysSinceResolved: 7 }).ok).toBe(true);
    const late = canTransition('RESOLVED', 'IN_PROGRESS', { actor: 'MEMBER', daysSinceResolved: 8 });
    expect(late.ok).toBe(false);
    if (!late.ok) expect(late.error.code).toBe('INVALID_ISSUE_TRANSITION');
  });

  it('treats a missing daysSinceResolved as outside the reopen window', () => {
    expect(canTransition('RESOLVED', 'IN_PROGRESS', member).ok).toBe(false);
  });

  it('lets staff reopen at any age', () => {
    expect(canTransition('RESOLVED', 'IN_PROGRESS', { actor: 'STAFF', daysSinceResolved: 400 }).ok).toBe(true);
  });

  it('refuses a SYSTEM reopen', () => {
    const result = canTransition('RESOLVED', 'IN_PROGRESS', system);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
  });

  it('lets the auto-close cron and the member both close a RESOLVED issue', () => {
    expect(canTransition('RESOLVED', 'CLOSED', system).ok).toBe(true);
    expect(canTransition('RESOLVED', 'CLOSED', member).ok).toBe(true);
  });

  it('makes CLOSED terminal for everyone', () => {
    for (const to of ISSUE_STATUSES) {
      if (to === 'CLOSED') continue;
      const result = canTransition('CLOSED', to, staff);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('ISSUE_CLOSED');
    }
    expect(isTerminal('CLOSED')).toBe(true);
    expect(isTerminal('OPEN')).toBe(false);
  });

  it('treats a repeated transition as a no-op', () => {
    for (const status of ISSUE_STATUSES) {
      expect(canTransition(status, status, staff).ok).toBe(true);
    }
  });

  it('rejects the skip-ahead OPEN -> RESOLVED', () => {
    const result = canTransition('OPEN', 'RESOLVED', staff);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_ISSUE_TRANSITION');
  });

  it('uses the D-003 member-facing labels', () => {
    expect(ISSUE_STATUS_LABELS.IN_PROGRESS).toBe('Owner reviewing');
  });

  it('narrows unknown values', () => {
    expect(isIssueStatus('OPEN')).toBe(true);
    expect(isIssueStatus('PENDING')).toBe(false);
    expect(isIssueStatus(undefined)).toBe(false);
  });
});
