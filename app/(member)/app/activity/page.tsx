import { redirect } from "next/navigation";
import { MemberHeader } from "@/components/member/MemberHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardBody } from "@/components/ui/Card";
import { ActivityIcon } from "@/components/ui/icons";
import { getMemberAttendance, getMemberSnapshot } from "@/lib/queries/member";
import { formatClock, formatDay, formatMonth } from "@/lib/format";
import { strings } from "@/lib/strings";

export const metadata = { title: strings.member.activityTitle };
export const dynamic = "force-dynamic";

export default async function MemberActivityPage() {
  const snapshot = await getMemberSnapshot();
  if (!snapshot) redirect("/join");

  const visits = await getMemberAttendance(snapshot.profile.id);

  // Grouped by month, newest first. The query already returns them in order,
  // so a Map preserves that without a second sort.
  const byMonth = new Map<string, typeof visits>();
  for (const visit of visits) {
    const key = formatMonth(visit.checked_in_at);
    const bucket = byMonth.get(key);
    if (bucket) bucket.push(visit);
    else byMonth.set(key, [visit]);
  }

  return (
    <>
      <MemberHeader title={strings.member.activityTitle} />

      {visits.length === 0 ? (
        <EmptyState
          icon={<ActivityIcon className="h-6 w-6" />}
          title={strings.member.activityEmpty}
          body={strings.member.activityEmptyBody}
        />
      ) : (
        <div className="space-y-5 px-4 pb-6">
          <p className="text-sm text-ink-muted">
            {strings.member.activityTotal(visits.length)}
          </p>

          {[...byMonth.entries()].map(([month, monthVisits]) => (
            <section key={month} className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display font-semibold text-ink">{month}</h2>
                <span className="text-xs text-ink-muted">
                  {strings.member.activityTotal(monthVisits.length)}
                </span>
              </div>

              <Card>
                <CardBody className="divide-y divide-border pt-0">
                  {monthVisits.map((visit) => (
                    <div
                      key={visit.id}
                      className="flex items-center justify-between gap-4 py-3"
                    >
                      <span className="text-ink">
                        {formatDay(visit.checked_in_at)}
                      </span>
                      <span className="font-display text-sm font-semibold text-ink-muted">
                        {formatClock(visit.checked_in_at)}
                      </span>
                    </div>
                  ))}
                </CardBody>
              </Card>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
