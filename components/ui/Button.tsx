import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand text-on-brand hover:bg-brand-hover active:bg-brand-hover disabled:bg-border-strong disabled:text-ink-muted",
  secondary:
    "bg-surface-raised text-ink border border-border hover:border-border-strong disabled:text-ink-muted",
  ghost:
    "bg-transparent text-ink hover:bg-surface-sunken disabled:text-ink-muted",
  danger:
    "bg-danger text-on-brand hover:opacity-90 disabled:bg-border-strong disabled:text-ink-muted",
};

const SIZES: Record<Size, string> = {
  // Touch targets stay at or above 44px on phones. sm is desktop-only.
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-11 px-4 text-base gap-2",
  lg: "h-14 px-5 text-lg gap-2.5",
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
