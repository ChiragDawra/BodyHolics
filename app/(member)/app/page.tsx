import { redirect } from "next/navigation";
import { MemberHeader } from "@/components/member/MemberHeader";
import { MemberTabBar } from "@/components/member/MemberTabBar";
import { AlertsBell } from "@/components/member/AlertsBell";
import { HeroStatus } from "@/components/member/HeroStatus";
import { CrowdMeter } from "@/components/member/CrowdMeter";
import { StreakCard } from "@/components/member/StreakCard";
import { Badge } from "@/components/ui/Badge";
import { Card, CardLabel } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TagIcon } from "@/components/ui/icons";
import {
  getMemberAlerts,
  getMemberAttendance,
  getMemberSnapshot,
} from "@/lib/queries/member";
import { computeStreak, visitedDays, weekStrip } from "@/lib/attendance";
import { formatHour, gymWeekdayLabel } from "@/lib/gym";
import { daysUntil, formatDay, formatRelative } from "@/lib/format";
import { strings } from "@/lib/strings";

export const metadata = { title: strings.member.homeTitle };
export const dynamic = "force-dynamic";

/**
 * The member home screen, as a bento grid.
 *
 * Order is the order of the questions: is it open, how busy, is my membership
 * valid — then the two motivational tiles. A vertical stack of equal cards
 * would give all five the same weight; the grid lets the hero and the live
 * count carry more.
 */
export default async function MemberHomePage() {
  const snapshot = await getMemberSnapshot();
  if (!snapshot) redirect("/join");

  // A member who has not given a phone number has not finished joining.
  if (!snapshot.profile.phone) redirect("/app/complete-profile");

  const [{ alerts, unreadIds }, checkIns] = await Promise.all([
    getMemberAlerts(snapshot.profile.gym_id, snapshot.profile.id),
    getMemberAttendance(snapshot.profile.id),
  ]);

  const days = visitedDays(checkIns);
  const streak = computeStreak(days);
  const week = weekStrip(days);

  const membership = snapshot.membership;
  const left = membership ? daysUntil(membership.end_date) : 0;
  const active =
    membership !== null && membership.status === "active" && left >= 0;

  // How far through the membership we are, for the progress rule.
  const spanDays = membership
    ? Math.max(
        1,
        Math.round(
          (new Date(membership.end_date).getTime() -
            new Date(membership.start_date).getTime()) /
            86_400_000,
        ),
      )
    : 1;
  const elapsedPct = membership
    ? Math.min(100, Math.max(0, Math.round(((spanDays - left) / spanDays) * 100)))
    : 0;

  return (
    <>
      <MemberHeader
        title={strings.app.name}
        action={
          <AlertsBell
            gymId={snapshot.profile.gym_id}
            initialAlerts={alerts}
            initialUnreadIds={unreadIds}
          />
        }
      />

      <div className="flex flex-col gap-2.5 px-4 pb-32">
        <HeroStatus state={snapshot.openState} />

        <div className="grid grid-cols-2 gap-2.5">
          <Card
            className="bh-rise p-4"
            /* delay so the tiles arrive in reading order */
            as="div"
          >
            <CrowdMeter level={snapshot.crowdLevel} />
          </Card>

          <Card className="bh-rise p-4">
            <CardLabel>{strings.member.rightNow}</CardLabel>
            <p className="mt-1.5 font-display text-4xl leading-none font-bold tracking-tighter text-brand">
              {snapshot.liveCount}
            </p>
            <p className="mt-1.5 text-sm text-ink-muted">
              {strings.member.inTheGym}
            </p>
            <p className="mt-3.5 text-xs leading-snug text-ink-dim">
              {strings.member.checkedInNotOut}
            </p>
          </Card>
        </div>

        <Card className="bh-rise p-4.5">
          {membership ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-ink-muted">
                  {membership.plan_name ?? ""}
                </span>
                <Badge tone={active ? "success" : "danger"}>
                  {active
                    ? strings.member.membershipActive
                    : membership.status === "cancelled"
                      ? strings.member.membershipCancelled
                      : strings.member.membershipExpired}
                </Badge>
              </div>

              <div className="mt-2.5 flex items-baseline gap-2.5">
                <span className="font-display text-4xl leading-none font-bold tracking-tighter text-brand">
                  {left}
                </span>
                <span className="text-base text-ink-muted">
                  {strings.member.daysLeft}
                </span>
              </div>

              <div className="mt-4 h-[0.1875rem] overflow-hidden rounded-full bg-surface-overlay">
                <div
                  className="h-full origin-left rounded-full bg-brand animate-[bh-bar_0.9s_cubic-bezier(0.22,1,0.36,1)_both]"
                  style={{ width: `${elapsedPct}%` }}
                />
              </div>

              <p className="mt-2.5 text-xs text-ink-dim">
                {strings.member.membershipEndsOn(formatDay(membership.end_date))}
              </p>
            </>
          ) : (
            <EmptyState
              icon={<TagIcon className="h-6 w-6" />}
              title={strings.member.noMembership}
              body={strings.member.noMembershipBody}
            />
          )}
        </Card>

        <Card className="bh-rise flex items-center gap-3 px-4.5 py-4">
          <span
            aria-hidden
            className="h-6.5 w-0.5 flex-none rounded-full bg-warning"
          />
          <div>
            <CardLabel>{strings.member.bestTime}</CardLabel>
            <p className="mt-1 text-sm font-medium leading-snug text-ink">
              {snapshot.quietestHour === null
                ? strings.member.bestTimeUnknown
                : strings.member.bestTimeValue(
                    formatHour(snapshot.quietestHour),
                    gymWeekdayLabel(),
                  )}
            </p>
          </div>
        </Card>

        <Card className="bh-rise p-4.5">
          <StreakCard streak={streak} week={week} />
        </Card>

        <div className="flex justify-between px-1.5 pt-1">
          <span className="text-xs text-ink-dim">
            {strings.member.visitsThisMonth(snapshot.visitsThisMonth)}
          </span>
          {snapshot.lastVisitAt ? (
            <span className="text-xs text-ink-dim">
              {strings.member.lastVisit(formatRelative(snapshot.lastVisitAt))}
            </span>
          ) : null}
        </div>
      </div>

      <MemberTabBar />
    </>
  );
}
