import Link from 'next/link';
import { requireStaffSession } from '@/lib/session';
import { formatInGymZone } from '@/lib/format';
import { listMembers } from '@/features/members/api';
import { MemberStatusBadge } from '@/features/members/components/member-status-badge';
import { MemberSearch } from '@/features/members/components/member-search';
import { Card, EmptyState } from '@/components/ui';
import { TableShell, Th, Td } from '@/components/data-table';

export const metadata = { title: 'Members — Urban Gym Admin' };

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireStaffSession();
  const { q = '' } = await searchParams;
  const members = await listMembers(session.gymId, q);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Members</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {/* CLAUDE.md rule 9 — there is no "Add member" button, by design. */}
            Members join by scanning the gym QR code in the app.
          </p>
        </div>
        <MemberSearch initialQuery={q} />
      </header>

      <Card>
        {members.length === 0 ? (
          <EmptyState
            title={q ? 'No members match that search' : 'No members yet'}
            hint={q ? 'Try a name or a member code such as UG-0001.' : undefined}
          />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Member</Th>
                <Th>Code</Th>
                <Th>Contact</Th>
                <Th>Status</Th>
                <Th>Renews</Th>
                <Th>Joined</Th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.userId} className="hover:bg-[var(--surface-raised)]">
                  <Td>
                    <Link href={`/members/${member.userId}`} className="font-medium hover:underline">
                      {member.fullName}
                    </Link>
                  </Td>
                  <Td className="numeric text-[var(--text-muted)]">{member.memberCode}</Td>
                  <Td className="numeric text-[var(--text-muted)]">{member.maskedContact}</Td>
                  <Td>
                    <MemberStatusBadge status={member.membershipStatus} />
                  </Td>
                  <Td className="numeric text-[var(--text-muted)]">
                    {member.endAt ? formatInGymZone(member.endAt, session.timezone) : '—'}
                  </Td>
                  <Td className="numeric text-[var(--text-muted)]">
                    {formatInGymZone(member.joinedAt, session.timezone)}
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
