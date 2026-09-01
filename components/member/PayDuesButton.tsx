"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { strings } from "@/lib/strings";

/**
 * Deliberately inert.
 *
 * Payments are out of scope for this build, but leaving the control out
 * entirely makes the screen look unfinished. Showing it greyed with an honest
 * explanation on tap is the more useful thing: it tells the owner where the
 * feature will live without pretending it exists.
 */
export function PayDuesButton() {
  const [showToast, setShowToast] = useState(false);

  return (
    <>
      <Button
        variant="disabled"
        size="md"
        aria-disabled
        onClick={() => {
          setShowToast(true);
          setTimeout(() => setShowToast(false), 2600);
        }}
      >
        {strings.member.payDues}
      </Button>

      {showToast ? (
        <div
          role="status"
          className="fixed inset-x-4 bottom-24 z-60 rounded-md border border-border-strong bg-surface-overlay/95 px-4 py-3.5 text-sm leading-snug text-ink backdrop-blur-xl animate-[bh-toast_0.24s_cubic-bezier(0.22,1,0.36,1)_both]"
        >
          {strings.member.payToast}
        </div>
      ) : null}
    </>
  );
}
