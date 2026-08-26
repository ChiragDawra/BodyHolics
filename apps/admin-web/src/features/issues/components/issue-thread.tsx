'use client';

import { useActionState } from 'react';
import { Button, Input, Label } from '@/components/ui';
import { replyToIssueAction, updateIssueStatusAction } from '../api';
import type { IssueActionResult, IssueDetail } from '../types';

const INITIAL: IssueActionResult = { status: 'idle' };

/**
 * The status buttons offered depend on where the issue is. docs/09 §4 does not
 * allow staff to push an issue back to OPEN, so that transition has no control
 * here — and the Edge Function would refuse it anyway.
 */
function nextStatuses(status: IssueDetail['status']): { value: string; label: string }[] {
  switch (status) {
    case 'OPEN':
      return [
        { value: 'IN_PROGRESS', label: 'Start work' },
        { value: 'RESOLVED', label: 'Mark resolved' },
      ];
    case 'IN_PROGRESS':
      return [{ value: 'RESOLVED', label: 'Mark resolved' }];
    case 'RESOLVED':
      return [{ value: 'CLOSED', label: 'Close' }];
    case 'CLOSED':
      return [];
  }
}

export function IssueThread({ issue }: { issue: IssueDetail }) {
  const [replyState, replyAction, replyPending] = useActionState(replyToIssueAction, INITIAL);
  const [statusState, statusAction, statusPending] = useActionState(
    updateIssueStatusAction,
    INITIAL,
  );

  const transitions = nextStatuses(issue.status);

  return (
    <div className="space-y-6">
      <ol className="space-y-3">
        <li className="rounded-[var(--radius-md)] border border-[var(--surface-border)] p-4">
          <p className="text-xs font-medium text-[var(--text-muted)]">
            {issue.memberName} · raised this
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm">{issue.description}</p>
        </li>

        {issue.messages.map((message) => (
          <li
            key={message.id}
            className={
              message.authorRole === 'STAFF'
                ? 'ml-6 rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-raised)] p-4'
                : 'mr-6 rounded-[var(--radius-md)] border border-[var(--surface-border)] p-4'
            }
          >
            <p className="text-xs font-medium text-[var(--text-muted)]">
              {message.authorName} · {message.authorRole === 'STAFF' ? 'staff' : 'member'}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm">{message.body}</p>
          </li>
        ))}
      </ol>

      {issue.status === 'CLOSED' ? (
        <p className="text-sm text-[var(--text-muted)]">
          This issue is closed. A member who replies will need to raise a new one.
        </p>
      ) : (
        <form action={replyAction} className="space-y-2">
          <input type="hidden" name="issueId" value={issue.id} />
          <Label htmlFor="body">Reply</Label>
          <Input id="body" name="body" required maxLength={2000} placeholder="Reply to the member" />
          {replyState.status !== 'idle' ? (
            <p
              role="status"
              className={
                replyState.status === 'error' ? 'text-sm text-danger-500' : 'text-sm text-accent-600'
              }
            >
              {replyState.message}
            </p>
          ) : null}
          <Button type="submit" disabled={replyPending}>
            {replyPending ? 'Sending…' : 'Send reply'}
          </Button>
        </form>
      )}

      {transitions.length > 0 ? (
        <div className="border-t border-[var(--surface-border)] pt-4">
          {statusState.status !== 'idle' ? (
            <p
              role="status"
              className={
                statusState.status === 'error'
                  ? 'mb-2 text-sm text-danger-500'
                  : 'mb-2 text-sm text-accent-600'
              }
            >
              {statusState.message}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {transitions.map((transition) => (
              <form key={transition.value} action={statusAction} className="contents">
                <input type="hidden" name="issueId" value={issue.id} />
                <input type="hidden" name="status" value={transition.value} />
                {transition.value === 'CLOSED' ? (
                  // docs/07 §7: a closing message is required, so it is collected
                  // rather than defaulted to something meaningless.
                  <Input
                    name="message"
                    required
                    maxLength={2000}
                    placeholder="Why is this being closed?"
                    className="max-w-xs"
                  />
                ) : null}
                <Button type="submit" variant="secondary" disabled={statusPending}>
                  {transition.label}
                </Button>
              </form>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
