import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger";

/* Tinted backgrounds rather than solid fills: on a dark ground a solid status
   chip shouts louder than the number it is labelling. */
const TONES: Record<Tone, string> = {
  neutral: "bg-surface-overlay text-ink-dim",
  brand: "bg-brand/15 text-brand",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/15 text-danger",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-2.5 py-1",
        "font-body font-semibold text-xs whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
