import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A number with a label above and a note below.
 *
 * The number is the biggest thing on the tile and the only thing coloured, so
 * a row of these reads as a row of values rather than a row of boxes. `size`
 * exists because a rupee figure needs more room per digit than a count does —
 * ₹1,24,500 at the same size as "71" would wrap.
 */
export function StatTile({
  label,
  value,
  note,
  tone = "default",
  size = "lg",
  delayMs = 0,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: "default" | "brand" | "warning" | "success";
  size?: "lg" | "md";
  delayMs?: number;
}) {
  return (
    <div
      style={{ animationDelay: `${delayMs}ms` }}
      className="bh-slide rounded-lg border border-border bg-surface-raised p-5"
    >
      <p className="font-body text-xs font-medium tracking-wide text-ink-dim">
        {label}
      </p>
      <p
        className={cn(
          "mt-3.5 font-display font-bold tracking-tighter",
          size === "lg" ? "text-5xl leading-none" : "text-3xl leading-tight",
          tone === "brand" && "text-brand",
          tone === "warning" && "text-warning",
          tone === "success" && "text-success",
          tone === "default" && "text-ink",
        )}
      >
        {value}
      </p>
      {note ? <p className="mt-3 text-xs text-ink-dim">{note}</p> : null}
    </div>
  );
}

/** Green when the change is good news, quiet otherwise. */
export function Delta({ positive, children }: { positive: boolean; children: ReactNode }) {
  return (
    <span className={positive ? "text-success" : "text-ink-dim"}>{children}</span>
  );
}
