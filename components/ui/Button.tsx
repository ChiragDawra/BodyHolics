import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "disabled";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  // on-brand is near-black: this orange is too bright for white text.
  primary:
    "bg-brand text-on-brand hover:bg-brand-hover disabled:bg-surface-overlay disabled:text-ink-faint",
  secondary:
    "bg-surface-overlay text-ink border border-border hover:bg-surface-high disabled:text-ink-faint",
  ghost: "bg-transparent text-ink-muted hover:text-ink disabled:text-ink-faint",
  danger: "bg-danger text-ink hover:opacity-90 disabled:bg-surface-overlay",
  /* A control that is visibly present but deliberately not available yet —
     "Pay dues" before online payments exist. Reads as off, not as broken. */
  disabled:
    "bg-surface-overlay text-ink-faint border border-border cursor-not-allowed",
};

const SIZES: Record<Size, string> = {
  // Touch targets clear the 44 point minimum on phones. sm is desktop-only.
  sm: "h-9 px-3.5 text-sm gap-1.5",
  md: "h-11 px-4 text-sm gap-2",
  lg: "h-13 px-5 text-base gap-2.5",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  children,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-display font-semibold",
        "transition-colors duration-150 select-none",
        "disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
    >
      {children}
    </button>
  );
}
