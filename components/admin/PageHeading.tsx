import type { ReactNode } from "react";

export function PageHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1.5 text-sm text-ink-dim">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
