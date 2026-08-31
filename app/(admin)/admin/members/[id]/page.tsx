import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/admin/PageHeading";
import { StartMembershipForm } from "@/components/admin/StartMembershipForm";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { CalendarIcon, ChevronLeftIcon, TagIcon } from "@/components/ui/icons";
import { getMemberDetail, getPlans, getStaffGym } from "@/lib/queries/admin";
import { daysUntil, formatClock, formatDay, formatFullDate } from "@/lib/format";
import { strings } from "@/lib/strings";

export const dynamic = "force-dynamic";

export default async function AdminMemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [gym, detail] = await Promise.all([getStaffGym(), getMemberDetail(id)]);
  if (!gym || !detail) notFound();

  const plans = (await getPlans(gym.id)).filter((p) => p.is_active);
  const { profile, memberships, attendance } = detail;

  return (
    <>
      <Link
        href="/admin/members"
        className="mb-4 inline-flex items-center gap-1 font-display text-sm font-semibold text-ink-muted hover:text-ink"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        {strings.admin.members.backToMembers}
      </Link>

      <PageHeading
        title={profile.full_name ?? profile.email ?? strings.admin.members.detailTitle}
        subtitle={`${profile.email ?? ""} · ${strings.admin.members.joined(formatDay(profile.created_at))}`}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={strings.admin.members.membershipHistory} />
          <CardBody>
            {memberships.length === 0 ? (
              <EmptyState
                icon={<TagIcon className="h-6 w-6" />}
                title={strings.admin.members.noMemberships}
                body={strings.admin.members.noMembershipsBody}
              />
            ) : (
              <ul className="divide-y divide-border">
                {memberships.map((m) => {
                  const live = m.status === "active" && daysUntil(m.end_date) >= 0;
                  return (
                    <li key={m.id} className="flex items-center justify-between gap-4 py-3 first:pt-0">
                      <div>
                        <p className="font-display font-semibold text-ink">
                          {m.plan_name ?? ""}
                        </p>
                        <p className="text-sm text-ink-muted">
                          {formatFullDate(m.start_date)} to {formatFullDate(m.end_date)}
                        </p>
                      </div>
                      <Badge tone={live ? "success" : "neutral"}>
                        {live
                          ? strings.member.membershipActive
                          : m.status === "cancelled"
                            ? strings.member.membershipCancelled
                            : strings.member.membershipExpired}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-4 border-t border-border pt-4">
              <h3 className="mb-3 font-display font-semibold text-ink">
                {strings.admin.members.giveMembership}
              </h3>
              {plans.length === 0 ? (
                <Link href="/admin/plans">
                  <Button variant="secondary" size="sm">
                    {strings.admin.plans.newPlan}
                  </Button>
                </Link>
              ) : (
                <StartMembershipForm
                  gymId={gym.id}
                  profileId={profile.id}
                  plans={plans}
                />
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={strings.admin.members.attendanceHistory}
            action={
              <span className="text-sm text-ink-muted">
                {strings.member.activityTotal(attendance.length)}
              </span>
            }
          />
          <CardBody>
            {attendance.length === 0 ? (
              <EmptyState
                icon={<CalendarIcon className="h-6 w-6" />}
                title={strings.admin.members.noAttendance}
                body={strings.admin.members.noAttendanceBody}
              />
            ) : (
              <ul className="max-h-96 divide-y divide-border overflow-y-auto">
                {attendance.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-4 py-2.5 first:pt-0"
                  >
                    <span className="text-ink">{formatDay(a.checked_in_at)}</span>
                    <span className="font-display text-sm font-semibold text-ink-muted">
                      {formatClock(a.checked_in_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
