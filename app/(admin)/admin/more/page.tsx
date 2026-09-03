import Link from "next/link";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { ChevronRightIcon } from "@/components/ui/icons";
import { getUser } from "@/lib/supabase/auth";
import {
  getAlerts,
  getPlans,
  getRevenueSummary,
  getStaff,
  getStaffGym,
  getTodayAttendance,
} from "@/lib/queries/admin";
import { blocksForDay, formatTime } from "@/lib/gym";
import { getGymSchedule } from "@/lib/queries/gym";
import { strings } from "@/lib/strings";

export const metadata = { title: strings.admin.nav.more };
export const dynamic = "force-dynamic";

/**
 * Phone-only index for the sections that do not get their own tab.
 *
 * Each row carries a live summary so the owner can often get the answer here
 * without opening the page at all — which is the point, since the pages
 * themselves are laid out for a laptop.
 */
export default async function AdminMorePage() {
  const gym = await getStaffGym();
  const user = await getUser();
  if (!gym) return null;

  const [revenue, today, alerts, plans, staff, schedule] = await Promise.all([
    getRevenueSummary(gym.id),
    getTodayAttendance(gym.id),
    getAlerts(gym.id),
    getPlans(gym.id),
    getStaff(gym.id),
    getGymSchedule(gym.id),
  ]);

  // Monday stands in for the week on this summary row; the Settings page is
  // where the whole schedule lives.
  const mondayBlocks = blocksForDay(schedule.hourBlocks, 1);

  const rows = [
    {
      href: "/admin/revenue",
      label: strings.admin.nav.revenue,
      summary: strings.admin.settings.revenueSummary(
        strings.common.rupees(revenue.thisMonthPaise),
      ),
    },
    {
      href: "/admin/attendance",
      label: strings.admin.nav.attendance,
      summary: strings.admin.settings.attendanceSummary(today.length),
    },
    {
      href: "/admin/alerts",
      label: strings.admin.nav.alerts,
      summary: strings.admin.settings.alertsSummary(alerts.length),
    },
    {
      href: "/admin/settings",
      label: strings.admin.settings.hoursHeading,
      summary:
        mondayBlocks.length === 0
          ? strings.admin.settings.closedLabel
          : mondayBlocks
              .map((b) =>
                strings.admin.settings.hoursSummary(
                  formatTime(b.start_time),
                  formatTime(b.end_time),
                ),
              )
              .join(" · "),
    },
    {
      href: "/admin/settings",
      label: strings.admin.settings.plansHeading,
      summary: strings.admin.settings.plansSummary(
        plans.filter((p) => p.is_active).length,
      ),
    },
    {
      href: "/admin/settings",
      label: strings.admin.settings.staffHeading,
      summary: strings.admin.settings.staffSummary(staff.length),
    },
  ];

  return (
    <>
      <p className="mb-3 px-1 text-xs text-ink-dim">{strings.admin.heavyWorkNote}</p>

      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <Link
            key={`${row.href}-${row.label}`}
            href={row.href}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-raised px-4.5 py-4 transition-colors hover:bg-surface-overlay"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">{row.label}</span>
              <span className="mt-0.5 block truncate text-xs text-ink-dim">
                {row.summary}
              </span>
            </span>
            <ChevronRightIcon className="h-4 w-4 flex-none text-ink-dim" />
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 px-1.5 pt-5">
        <span className="min-w-0 truncate text-xs text-ink-dim">
          {user?.email ?? ""}
        </span>
        <SignOutButton label={strings.admin.signOut} variant="link" />
      </div>
    </>
  );
}
