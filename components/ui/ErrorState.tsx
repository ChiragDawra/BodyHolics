import type { ReactNode } from "react";

/**
 * Errors name what broke and what to do about it. Never "Something went
 * wrong" — that tells the member nothing they can act on.
 */
export function ErrorState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-subtle">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          aria-hidden
          className="h-6 w-6 text-danger"
        >
          <path d="M12 7.5v5.5" />
          <circle cx="12" cy="16.5" r="0.6" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      </div>
      <p className="font-display font-semibold text-ink text-base">{title}</p>
      <p className="max-w-xs text-sm text-ink-muted text-balance">{body}</p>
      {action}
    </div>
  );
}
