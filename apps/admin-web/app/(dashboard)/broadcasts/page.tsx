import Link from 'next/link';
import { requireStaffSession } from '@/lib/session';
import { formatDateTimeInGymZone } from '@/lib/format';
import { listBroadcasts } from '@/features/broadcasts/api';
import { BroadcastList } from '@/features/broadcasts/components/broadcast-list';
import { Card, EmptyState, Button } from '@/components/ui';

export const metadata = { title: 'Announcements — Urban Gym Admin' };

export default async function BroadcastsPage() {
  const session = await requireStaffSession();
  const broadcasts = await listBroadcasts(session.gymId);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Announcements</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Recipients are resolved when an announcement is sent, from live membership data.
          </p>
        </div>
        <Link href="/broadcasts/new">
          <Button>New announcement</Button>
        </Link>
      </header>

      <Card>
        {broadcasts.length === 0 ? (
          <EmptyState title="No announcements yet" hint="Send one to reach members in the app." />
        ) : (
          <BroadcastList
            broadcasts={broadcasts}
            formatWhen={(iso) => formatDateTimeInGymZone(iso, session.timezone)}
          />
        )}
      </Card>
    </div>
  );
}
