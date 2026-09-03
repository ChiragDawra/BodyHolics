import type { MonthGrid } from "@/lib/attendance";
import { DAY_INITIALS } from "@/lib/gym";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/cn";

/**
 * A month of training as a contribution grid.
 *
 * A list of dates answers "when did I go"; the grid answers "am I actually
 * turning up", which is the question a member is really asking. Monday-first,
 * because that is how a training week is counted.
 */
export function ActivityGrid({
  month,
  monthLabel,
  highlight,
}: {
  month: MonthGrid;
  monthLabel: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-raised p-5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-ink-muted">{monthLabel}</span>
        <span className="text-xs text-ink-dim">
          {strings.member.daysOfMonth(month.visitedDayCount, month.daysInMonth)}
        </span>
      </div>

      <div className="mt-2 mb-4 flex items-baseline gap-2">
        <span
          className={cn(
            "font-display text-4xl leading-none font-bold tracking-tighter",
            highlight ? "text-brand" : "text-ink",
          )}
        >
          {month.visits}
        </span>
        <span className="text-sm text-ink-muted">
          {strings.member.visitsCount(month.visits)}
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {DAY_INITIALS.map((initial, i) => (
          <span
            key={i}
            aria-hidden
            className="text-center font-body text-[0.5625rem] font-medium text-ink-dim"
          >
            {initial}
          </span>
        ))}

        {month.cells.map((cell, i) =>
          cell === null ? (
            <span key={`pad-${i}`} aria-hidden />
          ) : (
            <span
              key={cell.key}
              style={{ animationDelay: `${i * 0.014}s` }}
              className={cn(
                "aspect-square rounded-sm animate-[bh-dot_0.3s_cubic-bezier(0.22,1,0.36,1)_both]",
                cell.visited ? "bg-brand" : "bg-surface-high",
                cell.isToday && !cell.visited && "ring-1 ring-ink-dim",
              )}
            />
          ),
        )}
      </div>
    </div>
  );
}

/** The flat 30-day strip used in the admin member panel. */
export function MiniGrid({ days }: { days: Array<{ key: string; visited: boolean }> }) {
  return (
    <div className="grid grid-cols-15 gap-1" aria-hidden>
      {days.map((d) => (
        <span
          key={d.key}
          className={cn(
            "aspect-square rounded-[0.1875rem]",
            d.visited ? "bg-brand" : "bg-surface-high",
          )}
        />
      ))}
    </div>
  );
}
