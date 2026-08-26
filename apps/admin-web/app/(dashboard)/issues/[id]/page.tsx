import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaffSession } from '@/lib/session';
import { formatDateTimeInGymZone } from '@/lib/format';
import { getIssue } from '@/features/issues/api';
import { IssueStatusBadge } from '@/features/issues/components/issue-status-badge';
import { IssueThread } from '@/features/issues/components/issue-thread';
import { Card, CardBody } from '@/components/ui';

export const metadata = { title: 'Issue — Urban Gym Admin' };

export default async function IssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaffSession();
  const { id } = await params;

  // An issue at another gym is a 404, never a 403 (docs/07 §1).
  const issue = await getIssue(session.gymId, id);
  if (!issue) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/issues" className="text-sm text-[var(--text-muted)] hover:underline">
          ← Issues
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{issue.title}</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {issue.category.toLowerCase()} · {issue.memberName} ·{' '}
            {formatDateTimeInGymZone(issue.createdAt, session.timezone)}
          </p>
        </div>
        <IssueStatusBadge status={issue.status} />
      </header>

      <Card>
        <CardBody>
          <IssueThread issue={issue} />
        </CardBody>
      </Card>
    </div>
  );
}
