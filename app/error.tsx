"use client";

import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { strings } from "@/lib/strings";

export default function RootError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <ErrorState
        title={strings.common.unexpectedTitle}
        body={strings.common.unexpectedBody}
        action={
          <Button variant="secondary" onClick={reset}>
            {strings.common.retry}
          </Button>
        }
      />
    </main>
  );
}
