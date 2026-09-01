import { cn } from "@/lib/cn";

/**
 * Loading placeholder. The shimmer is decorative, so it is suppressed by the
 * prefers-reduced-motion rule in globals.css and degrades to a flat block.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative overflow-hidden rounded-sm bg-surface-raised",
        "after:absolute after:inset-0 after:-translate-x-full",
        "after:bg-gradient-to-r after:from-transparent after:via-surface-overlay after:to-transparent",
        "after:animate-[bh-shimmer_1.4s_infinite]",
        className,
      )}
    />
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}
