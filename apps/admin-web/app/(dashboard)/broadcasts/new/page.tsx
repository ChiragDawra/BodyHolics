import Link from 'next/link';
import { requireStaffSession } from '@/lib/session';
import { BroadcastForm } from '@/features/broadcasts/components/broadcast-form';
import { Card, CardBody } from '@/components/ui';

export const metadata = { title: 'New announcement — Urban Gym Admin' };

export default async function NewBroadcastPage() {
  await requireStaffSession();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/broadcasts" className="text-sm text-[var(--text-muted)] hover:underline">
          ← Announcements
        </Link>
      </div>

      <header>
        <h1 className="text-xl font-semibold tracking-tight">New announcement</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Everyone in the chosen audience gets this as an alert in the app.
        </p>
      </header>

      <Card>
        <CardBody>
          <BroadcastForm />
        </CardBody>
      </Card>
    </div>
  );
}
