import { redirect } from "next/navigation";
import { MemberHeader } from "@/components/member/MemberHeader";
import { MemberTabBar } from "@/components/member/MemberTabBar";
import { ActivityGrid } from "@/components/member/ActivityGrid";
import { EmptyState } from "@/components/ui/EmptyState";
import { ActivityIcon } from "@/components/ui/icons";
import { getMemberAttendance, getMemberSnapshot } from "@/lib/queries/member";
import { monthGrids } from "@/lib/attendance";
import { formatMonth, formatDay } from "@/lib/format";
import { strings } from "@/lib/strings";

export const metadata = { title: strings.member.activityTitle };
export const dynamic = "force-dynamic";

export default async function MemberActivityPage() {
  const snapshot = await getMemberSnapshot();
  if (!snapshot) redirect("/join");
  if (!snapshot.profile.phone) redirect("/app/complete-profile");

  const visits = await getMemberAttendance(snapshot.profile.id);
  const months = monthGrids(visits);
  const oldest = visits[visits.length - 1];

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
        <div className="px-4 pb-32">
          <p className="mb-3.5 px-1 text-xs text-ink-dim">
            {strings.member.visitsSince(
              visits.length,
              oldest ? formatDay(oldest.checked_in_at) : "",
            )}
          </p>

          <div className="flex flex-col gap-3.5">
            {months.map((month, i) => (
              <ActivityGrid
                key={month.monthKey}
                month={month}
                monthLabel={formatMonth(`${month.monthKey}T12:00:00Z`)}
                highlight={i === 0}
              />
            ))}
          </div>
        </div>
      )}

      <MemberTabBar />
    </>
  );
}
