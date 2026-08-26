import Link from 'next/link';
import { requireStaffSession } from '@/lib/session';
import { formatPaise, formatDateTimeInGymZone } from '@/lib/format';
import { listPayments, parseStatusFilter } from '@/features/payments/api';
import { Badge, Card, EmptyState } from '@/components/ui';
import { TableShell, Th, Td } from '@/components/data-table';
import { StatTile } from '@/features/dashboard/components/stat-tile';
import { cn } from '@/lib/cn';

export const metadata = { title: 'Payments — Urban Gym Admin' };

const FILTERS = ['ALL', 'PENDING', 'PAID', 'FAILED', 'REFUNDED'] as const;

const TONE: Record<string, 'positive' | 'warning' | 'danger' | 'neutral'> = {
  PAID: 'positive',
  AUTHORIZED: 'warning',
  PENDING: 'warning',
  FAILED: 'danger',
  CANCELLED: 'neutral',
  REFUNDED: 'neutral',
};

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requireStaffSession();
  const params = await searchParams;
  const status = parseStatusFilter(params.status);
  const { rows, totals } = await listPayments(session.gymId, status);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Payments</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Read-only. A payment settles through the Razorpay webhook or a counter confirmation, never
          from this screen.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Settled to date" value={formatPaise(totals.paidPaise)} tone="positive" />
        <StatTile
          label="Pending"
          value={String(totals.pendingCount)}
          tone={totals.pendingCount > 0 ? 'warning' : 'neutral'}
        />
        <StatTile
          label="Failed"
          value={String(totals.failedCount)}
          tone={totals.failedCount > 0 ? 'danger' : 'neutral'}
        />
      </section>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {FILTERS.map((value) => (
          <Link
            key={value}
            href={value === 'ALL' ? '/payments' : `/payments?status=${value}`}
            aria-current={status === value ? 'page' : undefined}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              status === value
                ? 'border-transparent bg-[var(--accent)] text-[var(--on-accent)]'
                : 'border-[var(--surface-border)] text-[var(--text-muted)] hover:border-[var(--surface-border-strong)]',
            )}
          >
            {value === 'ALL' ? 'All' : value.charAt(0) + value.slice(1).toLowerCase()}
          </Link>
        ))}
      </nav>

      <Card>
        {rows.length === 0 ? (
          <EmptyState title="No payments match this filter" />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Member</Th>
                <Th>Amount</Th>
                <Th>Method</Th>
                <Th>Status</Th>
                <Th>Confirmed by</Th>
                <Th>When</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-[var(--surface-raised)]">
                  <Td>
                    <span className="font-medium">{row.memberName}</span>
                    {row.memberCode ? (
                      <span className="numeric ml-2 text-xs text-[var(--text-muted)]">
                        {row.memberCode}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="numeric font-medium">{formatPaise(row.amountPaise)}</Td>
                  <Td className="text-[var(--text-muted)]">
                    {row.method.toLowerCase().replace('_', ' ')}
                  </Td>
                  <Td>
                    <Badge tone={TONE[row.status] ?? 'neutral'}>{row.status.toLowerCase()}</Badge>
                  </Td>
                  <Td className="text-[var(--text-muted)]">{row.confirmedByName ?? '—'}</Td>
                  <Td className="numeric text-[var(--text-muted)]">
                    {formatDateTimeInGymZone(row.paidAt ?? row.createdAt, session.timezone)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Card>
    </div>
  );
}
