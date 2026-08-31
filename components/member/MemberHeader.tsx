import type { ReactNode } from "react";

/**
 * Sticky top bar for the member app. The top padding is what keeps the title
 * out from under the notch when the app runs standalone with a translucent
 * status bar.
 */
export function MemberHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur-sm pt-[env(safe-area-inset-top)]">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
          {title}
        </h1>
        {action}
      </div>
    </header>
  );
}
