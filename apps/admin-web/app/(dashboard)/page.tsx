import { requireStaffSession } from '@/lib/session';
import { formatPaiseCompact } from '@/lib/format';
import { getDashboardKpis, getAttentionQueue } from '@/features/dashboard/api';
import { StatTile } from '@/features/dashboard/components/stat-tile';
import { AttentionQueue } from '@/features/dashboard/components/attention-queue';

export const metadata = { title: 'Overview — Urban Gym Admin' };

export default async function OverviewPage() {
  const session = await requireStaffSession();

  const [kpis, attention] = await Promise.all([
    getDashboardKpis(session.gymId, session.timezone),
    getAttentionQueue(session.gymId),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Figures for {session.gymName}, in {session.timezone.replace('_', ' ')}.
        </p>
      </header>

      <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Active members"
          value={String(kpis.activeMembers)}
          hint={`${kpis.inactiveMembers} without a current membership`}
          tone="positive"
        />
        <StatTile
          label="Revenue this month"
          value={formatPaiseCompact(kpis.revenueThisMonthPaise)}
          hint="Settled payments only"
        />
        <StatTile
          label="Expiring soon"
          value={String(kpis.expiringSoon)}
          hint="Inside the renewal window"
          tone={kpis.expiringSoon > 0 ? 'warning' : 'neutral'}
        />
        <StatTile
          label="Pending payments"
          value={String(kpis.pendingPayments)}
          hint={`${kpis.openIssues} open issue${kpis.openIssues === 1 ? '' : 's'}`}
          tone={kpis.pendingPayments > 0 ? 'warning' : 'neutral'}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <AttentionQueue items={attention} />

        <div className="rounded-[var(--radius-lg)] border border-[var(--surface-border)] bg-[var(--surface-card)] p-5">
          <h2 className="text-sm font-semibold tracking-tight">This month</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-[var(--text-muted)]">New members</dt>
              <dd className="numeric font-medium">{kpis.newThisMonth}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-[var(--text-muted)]">Active</dt>
              <dd className="numeric font-medium">{kpis.activeMembers}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-[var(--text-muted)]">Lapsed</dt>
              <dd className="numeric font-medium">{kpis.inactiveMembers}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
