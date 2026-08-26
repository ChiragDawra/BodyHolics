'use client';

import { useActionState } from 'react';
import { Badge, Button } from '@/components/ui';
import { TableShell, Th, Td } from '@/components/data-table';
import { publishExistingAction } from '../api';
import type { BroadcastActionResult, BroadcastRow, BroadcastStatus } from '../types';

const INITIAL: BroadcastActionResult = { status: 'idle' };

const TONE: Record<BroadcastStatus, 'neutral' | 'warning' | 'positive'> = {
  DRAFT: 'neutral',
  SCHEDULED: 'warning',
  PUBLISHED: 'positive',
  CANCELLED: 'neutral',
};

export function BroadcastList({
  broadcasts,
  formatWhen,
}: {
  broadcasts: BroadcastRow[];
  formatWhen: (iso: string) => string;
}) {
  const [state, action, pending] = useActionState(publishExistingAction, INITIAL);

  return (
    <>
      {state.status !== 'idle' ? (
        <p
          role="status"
          className={
            state.status === 'error'
              ? 'px-5 pt-4 text-sm text-danger-500'
              : 'px-5 pt-4 text-sm text-accent-600'
          }
        >
          {state.message}
        </p>
      ) : null}

      <TableShell>
        <thead>
          <tr>
            <Th>Announcement</Th>
            <Th>Audience</Th>
            <Th>Status</Th>
            <Th>Reached</Th>
            <Th>When</Th>
            <Th className="text-right">Action</Th>
          </tr>
        </thead>
        <tbody>
          {broadcasts.map((row) => (
            <tr key={row.id}>
              <Td>
                <span className="font-medium">{row.title}</span>
                <span className="block text-xs text-[var(--text-muted)]">
                  {row.category.toLowerCase().replace(/_/g, ' ')}
                </span>
              </Td>
              <Td className="text-[var(--text-muted)]">{row.audienceLabel}</Td>
              <Td>
                <Badge tone={TONE[row.status]}>{row.status.toLowerCase()}</Badge>
              </Td>
              <Td className="numeric text-[var(--text-muted)]">
                {row.status === 'PUBLISHED' ? row.recipientCount : '—'}
              </Td>
              <Td className="numeric text-[var(--text-muted)]">
                {formatWhen(row.publishedAt ?? row.publishAt ?? row.createdAt)}
              </Td>
              <Td className="text-right">
                {/* PUBLISHED is terminal, so it offers no action at all — the
                    policy and the trigger both refuse an edit anyway. */}
                {row.status === 'DRAFT' || row.status === 'SCHEDULED' ? (
                  <form action={action} className="inline">
                    <input type="hidden" name="broadcastId" value={row.id} />
                    <Button type="submit" variant="secondary" size="sm" disabled={pending}>
                      Send now
                    </Button>
                  </form>
                ) : (
                  <span className="text-xs text-[var(--text-muted)]">—</span>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </TableShell>
    </>
  );
}
