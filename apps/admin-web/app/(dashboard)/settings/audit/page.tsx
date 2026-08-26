import { requireStaffSession } from '@/lib/session';
import { listAuditLog } from '@/features/audit/api';
import { formatDateTimeInGymZone, formatPaise } from '@/lib/format';
import { Card, CardHeader, CardTitle, EmptyState } from '@/components/ui';
import { TableShell, Th, Td } from '@/components/data-table';

export const metadata = { title: 'Audit log — Urban Gym Admin' };

/**
 * Renders one metadata blob as a short human phrase.
 *
 * Deliberately an allowlist rather than a dump of the JSON: metadata is written
 * by server code and could grow a field nobody meant to show an operator.
 */
function describe(action: string, metadata: Record<string, unknown>): string {
  const amount = metadata.amount_paise;
  if (typeof amount === 'number') return formatPaise(amount);

  const count = metadata.recipient_count;
  if (typeof count === 'number') return `${count} recipient${count === 1 ? '' : 's'}`;

  const expected = metadata.expected_paise;
  const received = metadata.received_paise;
  if (typeof expected === 'number' && typeof received === 'number') {
    return `expected ${formatPaise(expected)}, received ${formatPaise(received)}`;
  }

  const from = metadata.from;
  const to = metadata.to;
  if (typeof from === 'string' && typeof to === 'string') {
    return `${from.toLowerCase()} → ${to.toLowerCase()}`;
  }

  void action;
  return '—';
}

export default async function AuditPage() {
  const session = await requireStaffSession();
  const entries = await listAuditLog(session.gymId);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle>Audit log</CardTitle>
        <span className="text-xs text-[var(--text-muted)]">Owner only · append-only</span>
      </CardHeader>

      {entries.length === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          hint="Privileged actions — payments confirmed, memberships activated, announcements sent — appear here."
        />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Action</Th>
              <Th>By</Th>
              <Th>Detail</Th>
              <Th>When</Th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <Td className="font-medium">{entry.action.toLowerCase().replace(/_/g, ' ')}</Td>
                <Td className="text-[var(--text-muted)]">{entry.actorName ?? 'System'}</Td>
                <Td className="numeric text-[var(--text-muted)]">
                  {describe(entry.action, entry.metadata)}
                </Td>
                <Td className="numeric text-[var(--text-muted)]">
                  {formatDateTimeInGymZone(entry.createdAt, session.timezone)}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </Card>
  );
}
