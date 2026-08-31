"use client";

import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { strings } from "@/lib/strings";

export default function CheckError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-5">
      <ErrorState
        title={strings.common.unexpectedTitle}
        body={strings.common.unexpectedBody}
        action={
          <Button variant="secondary" onClick={reset}>
            {strings.common.retry}
          </Button>
        }
      />
    </div>
  );
}
