import { requireStaffSession } from '@/lib/session';
import { getAttendanceSummary } from '@/features/attendance/api';
import { TrafficChart } from '@/features/attendance/components/traffic-chart';
import { HourlyChart } from '@/features/attendance/components/hourly-chart';
import { StatTile } from '@/features/dashboard/components/stat-tile';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui';

export const metadata = { title: 'Attendance — Urban Gym Admin' };

export default async function AttendancePage() {
  const session = await requireStaffSession();
  const summary = await getAttendanceSummary(session.gymId, session.timezone);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Attendance</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Arrivals over the last 30 days, counted in {session.timezone.replace('_', ' ')}.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="In the gym now"
          value={String(summary.currentlyInside)}
          hint="Members with an open session"
          tone={summary.currentlyInside > 0 ? 'positive' : 'neutral'}
        />
        <StatTile label="Visits today" value={String(summary.visitsToday)} />
        <StatTile label="Visits this week" value={String(summary.visitsThisWeek)} hint="Last 7 days" />
      </section>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Daily arrivals</CardTitle>
        </CardHeader>
        <CardBody>
          <TrafficChart data={summary.byDay} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Busiest hours</CardTitle>
        </CardHeader>
        <CardBody>
          <HourlyChart data={summary.byHour} />
        </CardBody>
      </Card>
    </div>
  );
}
