import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { strings } from "@/lib/strings";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <EmptyState
        title={strings.common.notFoundTitle}
        body={strings.common.notFoundBody}
        action={
          <Link href="/">
            <Button variant="secondary">{strings.common.goHome}</Button>
          </Link>
        }
      />
    </main>
  );
}
