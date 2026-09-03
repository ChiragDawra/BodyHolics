import { formatTime, type OpenState } from "@/lib/gym";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/cn";

/**
 * The signature element of the whole app.
 *
 * "Is the gym open?" is the first of the three questions this exists to
 * answer, so it gets the only shouted word in the product and a coloured left
 * edge. Everything around it is deliberately quiet — this is the one place
 * boldness is spent.
 */
export function HeroStatus({
  state,
  liveLabel,
}: {
  state: OpenState;
  liveLabel?: string;
}) {
  const detail = state.isOpen
    ? state.closesAt
      ? strings.member.untilTime(formatTime(state.closesAt))
      : null
    : state.opensAt
      ? strings.member.opensAt(formatTime(state.opensAt))
      : state.todayBlocks.length === 0
        ? strings.member.closedToday
        : null;

  return (
    <div
      className={cn(
        "bh-rise rounded-lg border border-border bg-surface-raised px-6 py-7",
        state.isOpen ? "border-l-4 border-l-success" : "border-l-4 border-l-danger",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-5xl leading-none font-bold tracking-tighter text-ink">
            {state.isOpen ? strings.member.openLoud : strings.member.closedLoud}
          </p>
          {detail ? (
            <p className="mt-2.5 text-base text-ink-muted">{detail}</p>
          ) : null}
        </div>

        {state.isOpen ? (
          <div className="flex items-center gap-2 pt-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-success animate-[bh-halo_2s_ease-out_infinite]" />
              <span className="relative h-2 w-2 rounded-full bg-success animate-[bh-pulse_2s_ease-in-out_infinite]" />
            </span>
            <span className="text-xs font-medium text-success">
              {liveLabel ?? strings.member.live}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
