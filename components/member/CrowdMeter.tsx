import { CROWD_BG, CROWD_LEVELS, CROWD_FILL, CROWD_TEXT, type CrowdLevel } from "@/lib/gym";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/cn";

/**
 * How busy the gym is, as four segments rather than a percentage.
 *
 * The owner sets this by hand from the desk, so a precise-looking "68% full"
 * would claim accuracy the data does not have. Four segments read honestly at
 * a glance from across a loud room.
 */
export function CrowdMeter({ level }: { level: CrowdLevel }) {
  const filled = CROWD_FILL[level];

  return (
    <div>
      <p className="font-body text-label font-semibold tracking-label uppercase text-ink-dim">
        {strings.member.crowdHeading}
      </p>

      <p className={cn("mt-3 font-display text-xl font-bold", CROWD_TEXT[level])}>
        {strings.member.crowd[level]}
      </p>

      <div
        role="meter"
        aria-valuenow={filled}
        aria-valuemin={1}
        aria-valuemax={CROWD_LEVELS.length}
        aria-label={strings.member.crowdHeading}
        aria-valuetext={strings.member.crowd[level]}
        className="mt-3 flex gap-1"
      >
        {CROWD_LEVELS.map((_, i) => (
          <span
            key={i}
            style={{ animationDelay: `${0.35 + i * 0.08}s` }}
            className={cn(
              "h-1.5 flex-1 origin-bottom rounded-full",
              "animate-[bh-seg_0.3s_ease-out_both]",
              i < filled ? CROWD_BG[level] : "bg-surface-overlay",
            )}
          />
        ))}
      </div>

      <p className="mt-2.5 text-xs leading-snug text-ink-dim">
        {strings.member.crowdCaption[level]}
      </p>
    </div>
  );
}
