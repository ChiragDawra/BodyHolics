import type { Streak, WeekDot } from "@/lib/attendance";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/cn";

/**
 * Consecutive training days, with the last seven as dots.
 *
 * Today counts as unbroken until it is over — a member who trains in the
 * evening should not open the app at lunchtime and be told their streak died.
 */
export function StreakCard({ streak, week }: { streak: Streak; week: WeekDot[] }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-3xl leading-none font-bold tracking-tighter text-ink">
            {streak.current}
          </span>
          <span className="text-sm text-ink-muted">{strings.member.streak}</span>
        </div>
        <p className="mt-2 text-xs text-ink-dim">
          {streak.broken
            ? strings.member.streakBroken
            : strings.member.streakKeepGoing(streak.longest)}
        </p>
      </div>

      <div className="flex gap-1.5" aria-hidden>
        {week.map((day, i) => (
          <span key={day.key} className="flex flex-col items-center gap-1.5">
            <span
              style={{ animationDelay: `${i * 0.08}s` }}
              className={cn(
                "h-2.5 w-2.5 rounded-full animate-[bh-dot_0.28s_cubic-bezier(0.22,1,0.36,1)_both]",
                day.visited ? "bg-success" : "bg-surface-overlay",
                day.isToday && !day.visited && "ring-1 ring-ink-dim",
              )}
            />
            <span className="font-body text-[0.5625rem] font-medium text-ink-dim">
              {day.label}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
