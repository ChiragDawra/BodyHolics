import Link from 'next/link';
import { requireStaffSession } from '@/lib/session';
import { formatDateTimeInGymZone } from '@/lib/format';
import { listIssues } from '@/features/issues/api';
import { IssueStatusBadge } from '@/features/issues/components/issue-status-badge';
import { Card, EmptyState } from '@/components/ui';
import { TableShell, Th, Td } from '@/components/data-table';
import { cn } from '@/lib/cn';

export const metadata = { title: 'Issues — Urban Gym Admin' };

const FILTERS = [
  { value: undefined, label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
] as const;

export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requireStaffSession();
  const { status } = await searchParams;
  const issues = await listIssues(session.gymId, status);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Issues</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Raised by members from the app. Replying to an open issue acknowledges it.
        </p>
      </header>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.label}
            href={filter.value ? `/issues?status=${filter.value}` : '/issues'}
            aria-current={status === filter.value ? 'page' : undefined}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              status === filter.value
                ? 'border-transparent bg-[var(--accent)] text-[var(--on-accent)]'
                : 'border-[var(--surface-border)] text-[var(--text-muted)] hover:border-[var(--surface-border-strong)]',
            )}
          >
            {filter.label}
          </Link>
        ))}
      </nav>

      <Card>
        {issues.length === 0 ? (
          <EmptyState title="No issues match this filter" />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Issue</Th>
                <Th>Category</Th>
                <Th>Member</Th>
                <Th>Status</Th>
                <Th>Raised</Th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue) => (
                <tr key={issue.id} className="hover:bg-[var(--surface-raised)]">
                  <Td>
                    <Link href={`/issues/${issue.id}`} className="font-medium hover:underline">
                      {issue.title}
                    </Link>
                    {issue.status === 'OPEN' && !issue.acknowledgedAt ? (
                      <span className="ml-2 text-xs text-danger-500">unacknowledged</span>
                    ) : null}
                  </Td>
                  <Td className="text-[var(--text-muted)]">{issue.category.toLowerCase()}</Td>
                  <Td className="text-[var(--text-muted)]">{issue.memberName}</Td>
                  <Td>
                    <IssueStatusBadge status={issue.status} />
                  </Td>
                  <Td className="numeric text-[var(--text-muted)]">
                    {formatDateTimeInGymZone(issue.createdAt, session.timezone)}
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
