import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A raised panel. Deliberately plain — no shadow, one hairline border.
 * Identical soft-shadowed rounded cards everywhere is the look we are
 * avoiding, so weight comes from the border and the surface token instead.
 */
export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "li";
}) {
  return (
    <Tag
      className={cn(
        "bg-surface-raised border border-border rounded-lg",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
      <h2 className="font-display font-semibold text-ink text-lg">{title}</h2>
      {action}
    </div>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("px-4 pb-4", className)}>{children}</div>;
}
