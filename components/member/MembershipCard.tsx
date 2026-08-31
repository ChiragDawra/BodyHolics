import { Badge } from "@/components/ui/Badge";
import type { MembershipRow } from "@/lib/queries/member";
import { daysUntil, formatDay } from "@/lib/format";
import { strings } from "@/lib/strings";

/** True when the row says active *and* the end date has not passed. */
export function isCurrent(m: MembershipRow): boolean {
  return m.status === "active" && daysUntil(m.end_date) >= 0 && new Date(m.end_date) >= new Date(new Date().toDateString());
}

export function MembershipCard({ membership }: { membership: MembershipRow }) {
  const left = daysUntil(membership.end_date);
  const expired = membership.status === "expired" || left === 0;
  const cancelled = membership.status === "cancelled";
  const active = !expired && !cancelled;
  const endingSoon = active && left <= 7;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-xl font-bold text-ink">
          {membership.plan_name ?? strings.member.membershipHeading}
        </p>
        <Badge
          tone={cancelled ? "neutral" : expired ? "danger" : endingSoon ? "warning" : "success"}
        >
          {cancelled
            ? strings.member.membershipCancelled
            : expired
              ? strings.member.membershipExpired
              : strings.member.membershipActive}
        </Badge>
      </div>

      <p className="text-ink">
        {active
          ? strings.member.membershipEnds(formatDay(membership.end_date))
          : strings.member.membershipEnded(formatDay(membership.end_date))}
      </p>

      {active ? (
        <p className="font-display text-sm font-semibold text-ink-muted">
          {strings.member.membershipDaysLeft(left)}
        </p>
      ) : null}

      {endingSoon || expired ? (
        <p className="text-sm text-ink-muted">
          {strings.member.membershipExpiringSoon}
        </p>
      ) : null}
    </div>
  );
}
