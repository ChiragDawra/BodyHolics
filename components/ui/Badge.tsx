import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger";

/* Tinted backgrounds rather than solid fills: on a dark ground a solid status
   chip shouts louder than the number it is labelling. The text and the dot
   stay at full opacity so the chip still reads at arm's length. */
const TONES: Record<Tone, string> = {
  neutral: "bg-surface-overlay text-ink-muted",
  brand: "bg-brand/15 text-brand",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/15 text-danger",
};

const DOTS: Record<Tone, string> = {
  neutral: "bg-ink-dim",
  brand: "bg-brand",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

/**
 * A status pill: fully rounded, small, uppercase and tracked.
 *
 * Capsule rather than a rounded rectangle so it never reads as a button —
 * a badge states a fact, it is not something to press. `dot` adds the leading
 * indicator used on the states a member checks at a glance, ACTIVE and PAID.
 */
export function Badge({
  tone = "neutral",
  dot = false,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
        "font-body text-label font-semibold tracking-label uppercase whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {dot ? (
        <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", DOTS[tone])} />
      ) : null}
      {children}
    </span>
  );
}
