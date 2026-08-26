import { requireStaffSession } from '@/lib/session';
import { listHours } from '@/features/hours/api';
import { HoursForm } from '@/features/hours/components/hours-form';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui';

export const metadata = { title: 'Opening hours — Urban Gym Admin' };

export default async function HoursPage() {
  const session = await requireStaffSession();
  const hours = await listHours(session.gymId);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Weekly opening hours</CardTitle>
        <span className="text-xs text-[var(--text-muted)]">
          {session.timezone.replace('_', ' ')}
        </span>
      </CardHeader>
      <CardBody>
        <HoursForm hours={hours} />
      </CardBody>
    </Card>
  );
}
