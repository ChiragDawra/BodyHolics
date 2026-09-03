import { CardLabel } from "@/components/ui/Card";
import { formatShortDay, membershipSpan } from "@/lib/format";
import { strings } from "@/lib/strings";

/**
 * Start, today, expiry on one line.
 *
 * A countdown ("23 days left") answers how long is left but not how far
 * through you are — 23 days is most of a monthly plan and almost none of an
 * annual one. The line puts the number in its span: the filled portion is
 * time used, the donut is now, and the two ends are dates a member can check
 * against what they remember paying for.
 *
 * All three points carry real dates from the membership row. Nothing here is
 * illustrative.
 */
export function MembershipTimeline({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) {
  const span = membershipSpan(startDate, endDate);

  /**
   * The dot sits at the true position. Its label is clamped away from the
   * ends so it cannot collide with "Start" or "Expiry" on a 375px screen —
   * on the first and last day of a membership the marker is genuinely on top
   * of one of them, and a label overlapping a date is worse than a label
   * sitting slightly beside its dot.
   */
  const labelPct = Math.min(82, Math.max(18, span.pct));

  return (
    <div>
      <CardLabel>{strings.member.timelineHeading}</CardLabel>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={span.totalDays}
        aria-valuenow={span.elapsedDays}
        aria-valuetext={strings.member.membershipEndsOn(formatShortDay(endDate))}
        aria-label={strings.member.timelineHeading}
        className="relative mt-5 h-4"
      >
        {/* The full span, then the part of it that has been used. */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-surface-high"
        />
        <span
          aria-hidden
          style={{ width: `${span.pct}%` }}
          className="absolute left-0 top-1/2 h-0.5 origin-left -translate-y-1/2 rounded-full bg-brand animate-[bh-bar_0.9s_cubic-bezier(0.22,1,0.36,1)_both]"
        />

        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-brand"
        />

        {/* Today is a donut rather than a dot, so it stays legible when it
            lands on top of either end. */}
        <span
          aria-hidden
          style={{ left: `${span.pct}%` }}
          className="absolute top-1/2 flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-brand bg-surface-raised"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
        </span>

        <span
          aria-hidden
          className="absolute right-0 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-surface-high"
        />
      </div>

      <div className="relative mt-2.5 h-8">
        <Marker className="left-0" label={strings.member.timelineStart}>
          {formatShortDay(startDate)}
        </Marker>

        <Marker
          className="-translate-x-1/2 text-center"
          style={{ left: `${labelPct}%` }}
          label={strings.member.timelineToday}
          current
        >
          {formatShortDay(new Date().toISOString())}
        </Marker>

        <Marker className="right-0 text-right" label={strings.member.timelineExpiry}>
          {formatShortDay(endDate)}
        </Marker>
      </div>
    </div>
  );
}

function Marker({
  label,
  children,
  className,
  style,
  current = false,
}: {
  label: string;
  children: string;
  className?: string;
  style?: React.CSSProperties;
  current?: boolean;
}) {
  return (
    <span className={`absolute top-0 ${className ?? ""}`} style={style}>
      <span
        className={`block font-body text-label font-semibold tracking-label uppercase ${
          current ? "text-brand" : "text-ink-dim"
        }`}
      >
        {label}
      </span>
      <span
        className={`mt-1 block text-xs ${current ? "text-ink" : "text-ink-dim"}`}
      >
        {children}
      </span>
    </span>
  );
}
