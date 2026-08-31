import { MemberHeader } from "@/components/member/MemberHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { UserIcon } from "@/components/ui/icons";
import { strings } from "@/lib/strings";

export const metadata = { title: strings.member.meTitle };

export default function MemberMePage() {
  return (
    <>
      <MemberHeader title={strings.member.meTitle} />
      <EmptyState
        icon={<UserIcon className="h-6 w-6" />}
        title={strings.member.profileHeading}
        body={strings.member.noMembershipBody}
      />
    </>
  );
}
