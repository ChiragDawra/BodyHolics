import { CROWD_BG, CROWD_FILL, CROWD_LEVELS, type CrowdLevel } from "@/lib/gym";
import { formatRelative } from "@/lib/format";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/cn";

/**
 * How busy the gym is, as four bars rather than a percentage.
 *
 * The owner sets this by hand from the desk, so a precise-looking number would
 * claim more accuracy than the data has. Four filled bars reads honestly at a
 * glance from across a loud room.
 */
export function CrowdMeter({
  level,
  updatedAt,
}: {
  level: CrowdLevel;
  updatedAt: string;
}) {
  const filled = CROWD_FILL[level];

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-xl font-bold text-ink">
          {strings.member.crowd[level]}
        </p>
        <p className="shrink-0 text-xs text-ink-muted">
          {strings.member.crowdUpdated(formatRelative(updatedAt))}
        </p>
      </div>

      <div
        role="meter"
        aria-valuenow={filled}
        aria-valuemin={1}
        aria-valuemax={CROWD_LEVELS.length}
        aria-label={strings.member.crowdHeading}
        aria-valuetext={strings.member.crowd[level]}
        className="flex gap-1.5"
      >
        {CROWD_LEVELS.map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-2.5 flex-1 rounded-full transition-colors",
              i < filled ? CROWD_BG[level] : "bg-surface-sunken",
            )}
          />
        ))}
      </div>

      <p className="text-sm text-ink-muted">
        {strings.member.crowdCaption[level]}
      </p>
    </div>
  );
}
