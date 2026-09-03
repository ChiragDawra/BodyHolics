import Link from "next/link";
import { StatTile, Delta } from "@/components/admin/StatTile";
import { PageHeading } from "@/components/admin/PageHeading";
import { GymStatusControls } from "@/components/admin/GymStatusControls";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { RecentRegistrations } from "@/components/admin/RecentRegistrations";
import { QuickAlert } from "@/components/admin/QuickAlert";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  getDashboardStats,
  getRevenueSummary,
  getStaffGym,
} from "@/lib/queries/admin";
import { resolveCrowdLevel, resolveOpenState } from "@/lib/gym";
import { getGymSchedule } from "@/lib/queries/gym";
import { formatFullDate } from "@/lib/format";
import { strings } from "@/lib/strings";

export const metadata = { title: strings.admin.dashboard.title };
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const gym = await getStaffGym();
  if (!gym) {
    return (
      <ErrorState
        title={strings.common.networkErrorTitle}
        body={strings.common.networkErrorBody}
      />
    );
  }

  const [stats, revenue, schedule] = await Promise.all([
    getDashboardStats(gym.id),
    getRevenueSummary(gym.id),
    getGymSchedule(gym.id),
  ]);

  const openState = resolveOpenState(schedule.hourBlocks, gym.is_open_override);
  const crowd = resolveCrowdLevel(schedule.crowdSlots, gym.crowd_override);

  const thisMonthLabel = new Intl.DateTimeFormat("en-IN", { month: "long" }).format(
    new Date(),
  );
  const lastMonthLabel = revenue.months[revenue.months.length - 2]?.label ?? "";

  const revenueDeltaPct =
    revenue.lastMonthPaise === 0
      ? null
      : Math.round(
          ((revenue.thisMonthPaise - revenue.lastMonthPaise) / revenue.lastMonthPaise) * 100,
        );

  // Two different tiles, two different comparisons. They used to share one.
  const activeDelta = stats.activeMembers - stats.activeLastMonth;
  const newDelta = stats.newThisMonth - stats.newLastMonth;

  return (
    <>
      <PageHeading
        title={strings.admin.dashboard.title}
        subtitle={formatFullDate(new Date().toISOString())}
        action={
          <span className="hidden items-center gap-2 rounded-sm border border-border bg-surface-raised px-3 py-1.5 font-body text-xs font-medium text-ink-muted sm:inline-flex">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full bg-success animate-[bh-pulse_2s_ease-in-out_infinite]"
            />
            {strings.admin.live}
          </span>
        }
      />

      {/* Phone gets the one number that matters, at full width. */}
      <div className="sm:hidden">
        <StatTile
          label={strings.admin.dashboard.checkinsToday}
          value={stats.checkinsToday}
          tone="brand"
          note={
            <span className="text-success">
              {strings.admin.dashboard.stillIn(stats.inGymNow)}
            </span>
          }
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3.5 sm:mt-0 sm:grid-cols-4">
        <StatTile
          label={strings.admin.dashboard.activeMembers}
          value={stats.activeMembers}
          tone="brand"
          delayMs={0}
          note={
            <Delta positive={activeDelta > 0}>
              {strings.admin.dashboard.vsLastMonth(activeDelta)}
            </Delta>
          }
        />
        <StatTile
          label={strings.admin.dashboard.newThisMonth}
          value={stats.newThisMonth}
          delayMs={60}
          note={
            <Delta positive={newDelta > 0}>
              {strings.admin.dashboard.vsLastMonth(newDelta)}
            </Delta>
          }
        />
        <StatTile
          label={strings.admin.dashboard.collectedIn(thisMonthLabel)}
          value={strings.common.rupees(revenue.thisMonthPaise)}
          size="md"
          delayMs={120}
          note={
            revenueDeltaPct === null ? null : (
              <Delta positive={revenueDeltaPct >= 0}>
                {strings.admin.dashboard.percentVsLast(revenueDeltaPct, lastMonthLabel)}
              </Delta>
            )
          }
        />
        <StatTile
          label={strings.admin.dashboard.pendingDues}
          value={strings.common.rupees(revenue.outstandingPaise)}
          tone="warning"
          size="md"
          delayMs={180}
          note={strings.admin.dashboard.acrossMembers(revenue.outstandingMembers)}
        />
      </div>

      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface-raised p-5">
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <p className="font-body text-label font-semibold tracking-label uppercase text-ink-dim">
              {strings.admin.dashboard.recentRegistrations}
            </p>
            <Link
              href="/admin/members"
              className="font-body text-xs font-medium text-brand hover:text-brand-hover"
            >
              {strings.admin.dashboard.viewAllMembers}
            </Link>
          </div>
          <RecentRegistrations
            gymId={gym.id}
            initial={stats.recent}
            weekCount={stats.registrationsThisWeek}
          />
        </div>

        <div className="rounded-lg border border-border bg-surface-raised p-5">
          <GymStatusControls gymId={gym.id} openState={openState} crowd={crowd} />
          <div className="flex items-baseline gap-2.5 pt-4">
            <span className="font-display text-3xl leading-none font-bold tracking-tighter text-ink">
              {stats.inGymNow}
            </span>
            <span className="text-sm text-ink-muted">
              {strings.admin.dashboard.inGymNow(stats.inGymNow, stats.checkinsToday)}
            </span>
          </div>
        </div>
      </div>

      {/* Quick alert is phone-only; the desktop has a whole Alerts page. */}
      <div className="mt-3.5 sm:hidden">
        <QuickAlert gymId={gym.id} />
      </div>

      <div className="mt-3.5 hidden rounded-lg border border-border bg-surface-raised px-6 pb-4 pt-5 sm:block">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="font-body text-label font-semibold tracking-label uppercase text-ink-dim">
            {strings.admin.dashboard.revenueTrend}
          </p>
          <p className="text-xs text-ink-dim">
            {strings.admin.dashboard.collectedTotal(
              strings.common.rupees(
                revenue.months.reduce((sum, m) => sum + m.collectedPaise, 0),
              ),
            )}
          </p>
        </div>
        <RevenueChart months={revenue.months} />
      </div>
    </>
  );
}
