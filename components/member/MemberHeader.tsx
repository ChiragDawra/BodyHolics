import type { ReactNode } from "react";

/**
 * Top bar for the phone apps. The wordmark stays put across all three tabs —
 * the tab bar already says which screen you are on, so repeating it here
 * would be the second time the app tells you the same thing.
 *
 * Top padding clears the notch when running standalone with a translucent
 * status bar.
 */
export function MemberHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-3 px-5 pb-3 pt-[calc(1.25rem+env(safe-area-inset-top))]">
      <div className="min-w-0">
        <span className="block font-display text-[1.0625rem] font-bold tracking-tight text-ink">
          {title}
        </span>
        {subtitle ? (
          <span className="mt-0.5 block font-body text-xs font-medium tracking-wide text-brand">
            {subtitle}
          </span>
        ) : null}
      </div>
      {action}
    </header>
  );
}
