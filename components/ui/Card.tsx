import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A raised panel. No shadow, one hairline border — on a near-black ground a
 * shadow does nothing, and identical soft-shadowed cards everywhere is the
 * look this design is avoiding. Weight comes from the surface step alone.
 *
 * `accent` paints a 4px left edge, which is how the design marks the one card
 * on a screen that carries state: the open/closed hero, an unread alert.
 */
export function Card({
  children,
  className,
  accent,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  accent?: "success" | "danger" | "brand" | "warning";
  as?: "div" | "section" | "article" | "li";
}) {
  return (
    <Tag
      className={cn(
        "bg-surface-raised border border-border rounded-lg",
        accent === "success" && "border-l-4 border-l-success",
        accent === "danger" && "border-l-4 border-l-danger",
        accent === "brand" && "border-l-4 border-l-brand",
        accent === "warning" && "border-l-4 border-l-warning",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/** The small tracked label above a number. Used on every stat tile. */
export function CardLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-body text-xs font-medium tracking-wide text-ink-dim">
      {children}
    </p>
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
    <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-2">
      <CardLabel>{title}</CardLabel>
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
  return <div className={cn("px-5 pb-5", className)}>{children}</div>;
}
