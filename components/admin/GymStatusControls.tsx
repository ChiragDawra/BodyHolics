"use client";

import { useState, useTransition } from "react";
import { setCrowdLevel, setOpenOverride } from "@/lib/actions/admin";
import { CROWD_BG, CROWD_LEVELS, CROWD_TEXT, type CrowdLevel, type OpenState } from "@/lib/gym";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/cn";

/**
 * Open/closed and crowd level, the two things the owner changes most.
 *
 * Both write optimistically: the desk taps "Force closed" and the word flips
 * immediately, because waiting on a round trip in front of a queue is what
 * makes staff stop using a tool.
 *
 * "Optimistic" only works if a failure is visible. Until Phase 8 these
 * writes were being rejected by RLS, which Postgres reports as a successful
 * update of zero rows, so the action returned ok and the flip stuck on screen
 * while the database never changed. Both handlers now roll the local state
 * back and surface the message when the action fails, so a silent write can
 * never look like a successful one again.
 */
export function GymStatusControls({
  gymId,
  openState,
  crowdLevel,
  compact = false,
}: {
  gymId: string;
  openState: OpenState;
  crowdLevel: CrowdLevel;
  compact?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(openState.isOpen);
  const [overridden, setOverridden] = useState(openState.overridden);
  const [crowd, setCrowd] = useState(crowdLevel);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const applyOverride = (value: boolean | null) => {
    const previous = { isOpen, overridden };
    setError(null);
    setOverridden(value !== null);
    setIsOpen(value !== null ? value : openState.isOpen);

    startTransition(async () => {
      const result = await setOpenOverride({ gymId, isOpen: value });
      if (!result.ok) {
        setIsOpen(previous.isOpen);
        setOverridden(previous.overridden);
        setError(result.message);
      }
    });
  };

  const applyCrowd = (level: CrowdLevel) => {
    const previous = crowd;
    setError(null);
    setCrowd(level);

    startTransition(async () => {
      const result = await setCrowdLevel({ gymId, level });
      if (!result.ok) {
        setCrowd(previous);
        setError(result.message);
      }
    });
  };

  return (
    <div className={cn("flex flex-col", compact ? "gap-2.5" : "gap-0")}>
      <div
        className={cn(
          "flex items-center justify-between gap-3",
          compact
            ? "rounded-lg border border-border bg-surface-raised p-4.5 border-l-4"
            : "border-b border-border-soft pb-4",
          compact && (isOpen ? "border-l-success" : "border-l-danger"),
        )}
      >
        <div>
          <p className="font-body text-xs font-medium tracking-wide text-ink-dim">
            {strings.admin.dashboard.gymStatus}
          </p>
          <div className="mt-2 flex items-center gap-2.5">
            <span
              aria-hidden
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                isOpen ? "bg-success" : "bg-danger",
              )}
            />
            <span className="font-display text-2xl leading-none font-bold tracking-tight text-ink">
              {isOpen ? strings.member.openLoud : strings.member.closedLoud}
            </span>
          </div>
        </div>

        <div className="flex flex-none gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => applyOverride(isOpen ? false : true)}
            className="h-11 rounded-md border border-border bg-surface-overlay px-4 font-display text-xs font-semibold text-ink transition-colors hover:bg-surface-high disabled:opacity-60"
          >
            {isOpen ? strings.admin.settings.forceClosed : strings.admin.settings.forceOpen}
          </button>
          {overridden ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => applyOverride(null)}
              className="h-11 rounded-md border border-border px-4 font-display text-xs font-semibold text-ink-dim transition-colors hover:text-ink disabled:opacity-60"
            >
              {strings.admin.settings.followHours}
            </button>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          compact ? "rounded-lg border border-border bg-surface-raised p-4" : "py-4",
        )}
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-body text-xs font-medium tracking-wide text-ink-dim">
            {strings.admin.settings.crowdHeading}
          </p>
          <p className={cn("font-display text-[0.9375rem] font-bold", CROWD_TEXT[crowd])}>
            {strings.member.crowd[crowd]}
          </p>
        </div>

        <div className="mt-3.5 grid grid-cols-2 gap-2">
          {CROWD_LEVELS.map((level) => {
            const active = crowd === level;
            return (
              <button
                key={level}
                type="button"
                disabled={pending}
                aria-pressed={active}
                onClick={() => applyCrowd(level)}
                className={cn(
                  "flex items-center gap-2 rounded-sm border px-3 py-2.5 text-left",
                  "font-body text-xs font-medium transition-colors disabled:opacity-60",
                  active
                    ? "border-border-strong bg-surface-overlay text-ink"
                    : "border-border text-ink-dim hover:text-ink-muted",
                )}
              >
                <span
                  aria-hidden
                  className={cn("h-1.5 w-1.5 flex-none rounded-full", CROWD_BG[level])}
                />
                {strings.member.crowd[level]}
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <p role="alert" className="pt-2 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
