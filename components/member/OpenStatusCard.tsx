import type { OpenState } from "@/lib/gym";
import { formatTime } from "@/lib/gym";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/cn";

/**
 * The signature element of the member app.
 *
 * "Is the gym open?" is the first of the three questions this app exists to
 * answer, so it gets the largest type on the screen and a full-bleed colour
 * block. Everything around it is deliberately quiet.
 */
export function OpenStatusCard({ state }: { state: OpenState }) {
  const detail = state.isOpen
    ? state.closesAt
      ? strings.member.closesAt(formatTime(state.closesAt))
      : null
    : state.opensAt
      ? strings.member.opensAt(formatTime(state.opensAt))
      : state.today === null
        ? strings.member.closedToday
        : null;

  return (
    <div
      className={cn(
        "rounded-lg border px-5 py-6",
        state.isOpen
          ? "border-success bg-success-subtle"
          : "border-danger bg-danger-subtle",
      )}
    >
      <p
        className={cn(
          "font-display text-3xl font-bold tracking-tight",
          state.isOpen ? "text-success" : "text-danger",
        )}
      >
        {state.isOpen ? strings.member.gymOpen : strings.member.gymClosed}
      </p>
      {detail ? <p className="mt-1 text-ink-muted">{detail}</p> : null}
    </div>
  );
}
