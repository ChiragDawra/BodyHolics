import { MemberHeader } from "@/components/member/MemberHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ActivityIcon } from "@/components/ui/icons";
import { strings } from "@/lib/strings";

export const metadata = { title: strings.member.activityTitle };

export default function MemberActivityPage() {
  return (
    <>
      <MemberHeader title={strings.member.activityTitle} />
      <EmptyState
        icon={<ActivityIcon className="h-6 w-6" />}
        title={strings.member.activityEmpty}
        body={strings.member.activityEmptyBody}
      />
    </>
  );
}
