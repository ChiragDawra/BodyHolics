import type { ReactNode } from "react";

/**
 * Empty states invite action rather than reporting absence. Copy always comes
 * from lib/strings.ts.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      {icon ? (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-sunken text-ink-muted">
          {icon}
        </div>
      ) : null}
      <p className="font-display font-semibold text-ink text-base">{title}</p>
      {body ? (
        <p className="max-w-xs text-sm text-ink-muted text-balance">{body}</p>
      ) : null}
      {action}
    </div>
  );
}
