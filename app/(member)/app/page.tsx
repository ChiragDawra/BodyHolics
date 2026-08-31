import { redirect } from "next/navigation";
import { MemberHeader } from "@/components/member/MemberHeader";
import { AlertsBell } from "@/components/member/AlertsBell";
import { OpenStatusCard } from "@/components/member/OpenStatusCard";
import { CrowdMeter } from "@/components/member/CrowdMeter";
import { MembershipCard } from "@/components/member/MembershipCard";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TagIcon } from "@/components/ui/icons";
import { getMemberAlerts, getMemberSnapshot } from "@/lib/queries/member";
import { strings } from "@/lib/strings";

export const metadata = { title: strings.member.homeTitle };
export const dynamic = "force-dynamic";

/**
 * The three questions this app exists to answer, in order, with no tapping:
 * is the gym open, how busy is it, and is my membership still valid.
 */
export default async function MemberHomePage() {
  const snapshot = await getMemberSnapshot();
  if (!snapshot) redirect("/join");

  const { alerts, unreadIds } = await getMemberAlerts(
    snapshot.profile.gym_id,
    snapshot.profile.id,
  );

  return (
    <>
      <MemberHeader
        title={strings.member.greeting(snapshot.profile.full_name)}
        action={
          <AlertsBell
            gymId={snapshot.profile.gym_id}
            initialAlerts={alerts}
            initialUnreadIds={unreadIds}
          />
        }
      />

      <div className="space-y-4 px-4 pb-6">
        <OpenStatusCard state={snapshot.openState} />

        <Card>
          <CardBody className="pt-4">
            <CrowdMeter
              level={snapshot.crowdLevel}
              updatedAt={snapshot.crowdUpdatedAt}
            />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="pt-4">
            {snapshot.membership ? (
              <MembershipCard membership={snapshot.membership} />
            ) : (
              <EmptyState
                icon={<TagIcon className="h-6 w-6" />}
                title={strings.member.noMembership}
                body={strings.member.noMembershipBody}
              />
            )}
          </CardBody>
        </Card>

        {snapshot.visitsThisMonth > 0 ? (
          <p className="px-1 text-sm text-ink-muted">
            {strings.member.visitsThisMonth(snapshot.visitsThisMonth)}
          </p>
        ) : null}
      </div>
    </>
  );
}
