import { requireStaffSession } from '@/lib/session';
import { listStaff } from '@/features/staff/api';
import { formatInGymZone } from '@/lib/format';
import { Badge, Card, CardHeader, CardTitle, EmptyState } from '@/components/ui';
import { TableShell, Th, Td } from '@/components/data-table';

export const metadata = { title: 'Staff — Urban Gym Admin' };

export default async function StaffPage() {
  const session = await requireStaffSession();
  const staff = await listStaff(session.gymId);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle>Staff access</CardTitle>
      </CardHeader>

      {staff.length === 0 ? (
        <EmptyState title="No staff yet" />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Role</Th>
              <Th>Status</Th>
              <Th>Added</Th>
            </tr>
          </thead>
          <tbody>
            {staff.map((member) => (
              <tr key={member.userId}>
                <Td className="font-medium">{member.fullName}</Td>
                <Td>
                  <Badge tone={member.role === 'OWNER' ? 'info' : 'neutral'}>
                    {member.role === 'OWNER' ? 'Owner' : 'Staff'}
                  </Badge>
                </Td>
                <Td>
                  <Badge tone={member.status === 'ACTIVE' ? 'positive' : 'neutral'}>
                    {member.status === 'ACTIVE' ? 'Active' : 'Disabled'}
                  </Badge>
                </Td>
                <Td className="numeric text-[var(--text-muted)]">
                  {formatInGymZone(member.createdAt, session.timezone)}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}

      <div className="border-t border-[var(--surface-border)] px-5 py-4">
        <p className="text-sm text-[var(--text-muted)]">
          {/* docs/04 §4 — bootstrapping an owner is a manual, audited insert per
              environment rather than a signup flow, so there is no invite button. */}
          Adding staff is done directly against the database and audited. Disabling an account takes
          effect on their next request.
        </p>
      </div>
    </Card>
  );
}
