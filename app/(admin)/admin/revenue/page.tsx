import { PageHeading } from "@/components/admin/PageHeading";
import { StatTile } from "@/components/admin/StatTile";
import { RevenueBars } from "@/components/admin/RevenueChart";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { TagIcon } from "@/components/ui/icons";
import { getPayments, getRevenueSummary, getStaffGym } from "@/lib/queries/admin";
import { formatDay } from "@/lib/format";
import { strings } from "@/lib/strings";

export const metadata = { title: strings.admin.revenue.title };
export const dynamic = "force-dynamic";

export default async function AdminRevenuePage() {
  const gym = await getStaffGym();
  if (!gym) {
    return (
      <ErrorState
        title={strings.common.networkErrorTitle}
        body={strings.common.networkErrorBody}
      />
    );
  }

  const [revenue, payments] = await Promise.all([
    getRevenueSummary(gym.id),
    getPayments(gym.id),
  ]);

  return (
    <>
      <PageHeading title={strings.admin.revenue.title} subtitle={strings.admin.revenue.lede} />

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatTile
          label={strings.admin.revenue.lifetime}
          value={strings.common.rupees(revenue.lifetimePaise)}
          size="md"
        />
        <StatTile
          label={strings.admin.revenue.thisMonth}
          value={strings.common.rupees(revenue.thisMonthPaise)}
          tone="brand"
          size="md"
          delayMs={60}
        />
        <StatTile
          label={strings.admin.revenue.lastMonth}
          value={strings.common.rupees(revenue.lastMonthPaise)}
          size="md"
          delayMs={120}
        />
        <StatTile
          label={strings.admin.revenue.outstanding}
          value={strings.common.rupees(revenue.outstandingPaise)}
          tone="warning"
          size="md"
          delayMs={180}
        />
      </div>

      <div className="mt-3.5 flex flex-col items-start gap-3.5 xl:flex-row">
        <div className="w-full min-w-0 overflow-hidden rounded-lg border border-border bg-surface-raised xl:flex-1">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <p className="font-body text-xs font-medium tracking-wide text-ink-dim">
              {strings.admin.revenue.paymentsIn(
                new Intl.DateTimeFormat("en-IN", { month: "long" }).format(new Date()),
              )}
            </p>
            <span className="text-xs text-ink-dim">
              {strings.admin.revenue.sortedByDate}
            </span>
          </div>

          {payments.length === 0 ? (
            <EmptyState
              icon={<TagIcon className="h-6 w-6" />}
              title={strings.admin.revenue.empty}
              body={strings.admin.revenue.emptyBody}
            />
          ) : (
            <>
              <div className="hidden grid-cols-[0.9fr_1.3fr_1fr_0.9fr_0.8fr_0.8fr] gap-3.5 border-b border-border px-5 py-3 font-body text-[0.625rem] font-medium tracking-wider text-ink-dim lg:grid">
                <span>{strings.admin.revenue.colDate}</span>
                <span>{strings.admin.revenue.colMember}</span>
                <span>{strings.admin.revenue.colPlan}</span>
                <span>{strings.admin.revenue.colAmount}</span>
                <span>{strings.admin.revenue.colMethod}</span>
                <span>{strings.admin.revenue.colStatus}</span>
              </div>

              <ul className="max-h-[36rem] overflow-y-auto">
                {payments.map((p) => (
                  <li
                    key={p.id}
                    className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-border-soft px-5 py-3.5 lg:grid-cols-[0.9fr_1.3fr_1fr_0.9fr_0.8fr_0.8fr] lg:gap-3.5"
                  >
                    <span className="hidden text-xs text-ink-muted lg:block">
                      {formatDay(p.paid_at)}
                    </span>

                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">
                        {p.full_name ?? ""}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-ink-dim lg:hidden">
                        {formatDay(p.paid_at)} · {p.plan_name ?? ""}
                      </span>
                    </span>

                    <span className="hidden text-xs text-ink-muted lg:block">
                      {p.plan_name ?? "—"}
                    </span>
                    <span className="hidden font-display text-sm font-medium text-ink lg:block">
                      {strings.common.rupees(p.amount_paise)}
                    </span>
                    <span className="hidden text-xs text-ink-muted lg:block">
                      {strings.admin.revenue.method[p.method]}
                    </span>

                    <span className="flex items-center gap-2 justify-self-end lg:justify-self-start">
                      <span className="font-display text-sm font-medium text-ink lg:hidden">
                        {strings.common.rupees(p.amount_paise)}
                      </span>
                      <Badge
                        tone={
                          p.status === "collected"
                            ? "success"
                            : p.status === "pending"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {strings.admin.revenue.status[p.status]}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="w-full flex-none rounded-lg border border-border bg-surface-raised p-5 xl:w-75">
          <p className="mb-5 font-body text-xs font-medium tracking-wide text-ink-dim">
            {strings.admin.revenue.last6}
          </p>
          <RevenueBars months={revenue.months} />
        </div>
      </div>
    </>
  );
}
