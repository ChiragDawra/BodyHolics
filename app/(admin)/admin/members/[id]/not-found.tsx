import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { strings } from "@/lib/strings";

export default function MemberNotFound() {
  return (
    <EmptyState
      title={strings.common.notFoundTitle}
      body={strings.admin.members.noMatchBody}
      action={
        <Link href="/admin/members">
          <Button variant="secondary">
            {strings.admin.members.backToMembers}
          </Button>
        </Link>
      }
    />
  );
}
