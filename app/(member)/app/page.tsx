import { MemberHeader } from "@/components/member/MemberHeader";
import { AlertsBell } from "@/components/member/AlertsBell";
import { EmptyState } from "@/components/ui/EmptyState";
import { HomeIcon } from "@/components/ui/icons";
import { strings } from "@/lib/strings";

export const metadata = { title: strings.member.homeTitle };

export default function MemberHomePage() {
  return (
    <>
      <MemberHeader
        title={strings.member.homeTitle}
        action={<AlertsBell gymId="" initialAlerts={[]} initialUnreadIds={[]} />}
      />
      <EmptyState
        icon={<HomeIcon className="h-6 w-6" />}
        title={strings.member.noMembership}
        body={strings.member.noMembershipBody}
      />
    </>
  );
}
