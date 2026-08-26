import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireStaffSession } from '@/lib/session';
import { formatPaise, formatInGymZone, formatDateTimeInGymZone } from '@/lib/format';
import { getMember } from '@/features/members/api';
import { MemberStatusBadge } from '@/features/members/components/member-status-badge';
import { Badge, Card, CardHeader, CardTitle, EmptyState } from '@/components/ui';
import { TableShell, Th, Td } from '@/components/data-table';

export const metadata = { title: 'Member — Urban Gym Admin' };

const PAYMENT_TONE: Record<string, 'positive' | 'warning' | 'danger' | 'neutral'> = {
  PAID: 'positive',
  AUTHORIZED: 'warning',
  PENDING: 'warning',
  FAILED: 'danger',
  CANCELLED: 'neutral',
  REFUNDED: 'neutral',
};

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaffSession();
  const { id } = await params;

  // getMember filters on the caller's gym, and RLS would refuse the row anyway.
  // A member of another gym is a 404 here, not a 403: confirming the id exists
  // would leak the shape of another tenant's data.
  const member = await getMember(session.gymId, id);
  if (!member) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href="/members" className="text-sm text-[var(--text-muted)] hover:underline">
          ← Members
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{member.fullName}</h1>
          <p className="numeric mt-1 text-sm text-[var(--text-muted)]">
            {member.memberCode} · {member.maskedPhone} · joined{' '}
            {formatInGymZone(member.joinedAt, session.timezone)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MemberStatusBadge status={member.membershipStatus} />
          {member.gymMemberStatus === 'BLOCKED' ? <Badge tone="danger">Blocked</Badge> : null}
        </div>
      </header>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Memberships</CardTitle>
        </CardHeader>
        {member.memberships.length === 0 ? (
          <EmptyState title="No memberships yet" />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Plan</Th>
                <Th>Status</Th>
                <Th>Paid</Th>
                <Th>Period</Th>
              </tr>
            </thead>
            <tbody>
              {member.memberships.map((row) => (
                <tr key={row.id}>
                  <Td className="font-medium">{row.planName}</Td>
                  <Td>
                    <Badge tone={row.status === 'ACTIVE' ? 'positive' : 'neutral'}>
                      {row.status.toLowerCase().replace('_', ' ')}
                    </Badge>
                  </Td>
                  <Td className="numeric">{formatPaise(row.pricePaise)}</Td>
                  <Td className="numeric text-[var(--text-muted)]">
                    {row.startAt && row.endAt
                      ? `${formatInGymZone(row.startAt, session.timezone)} – ${formatInGymZone(row.endAt, session.timezone)}`
                      : '—'}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Payments</CardTitle>
        </CardHeader>
        {member.payments.length === 0 ? (
          <EmptyState title="No payments yet" />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Amount</Th>
                <Th>Method</Th>
                <Th>Status</Th>
                <Th>When</Th>
              </tr>
            </thead>
            <tbody>
              {member.payments.map((row) => (
                <tr key={row.id}>
                  <Td className="numeric font-medium">{formatPaise(row.amountPaise)}</Td>
                  <Td className="text-[var(--text-muted)]">
                    {row.method.toLowerCase().replace('_', ' ')}
                  </Td>
                  <Td>
                    <Badge tone={PAYMENT_TONE[row.status] ?? 'neutral'}>
                      {row.status.toLowerCase()}
                    </Badge>
                  </Td>
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
