import { strings } from "@/lib/strings";

/**
 * The tilted wall of gym slogans behind the launch screen.
 *
 * Purely decorative and `aria-hidden`: a screen reader announcing fifty-eight
 * motivational slogans before reaching "Join as a new member" would be a
 * worse experience than no background at all.
 *
 * Two deliberate departures from the reference mock-up:
 *
 *   - It is built from one list, rotated per row, instead of ~280 hand-written
 *     spans. The wall has to cover a rotated rectangle larger than the
 *     viewport, so the amount of text needed is a function of the screen, not
 *     something worth maintaining by hand.
 *
 *   - No per-badge `backdrop-filter`. The mock-up blurs behind every pill;
 *     at this count that is hundreds of separate backdrop passes, which is
 *     exactly the kind of thing that turns a scroll janky on the mid-range
 *     Android this is mostly opened on. A flat translucent fill is
 *     indistinguishable here and costs nothing.
 */
export function QuotesWall() {
  const quotes = strings.landing.wall;

  /**
   * Each row starts further along the list than the last, so no two rows line
   * up and the wall reads as continuous text rather than a repeating pattern.
   * The offsets are fixed rather than random so the server and the client
   * render the same thing.
   */
  const rows = Array.from({ length: 16 }, (_, row) => {
    const start = (row * 7) % quotes.length;
    return Array.from(
      { length: 14 },
      (_, i) => quotes[(start + i * 3) % quotes.length]!,
    );
  });

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 select-none overflow-hidden"
    >
      {/*
        Sized well past the viewport because it is rotated: a 100vw box turned
        25 degrees leaves bare corners.
      */}
      <div className="bh-quote-wall">
        {rows.map((quotesInRow, row) => (
          <div
            key={row}
            className="flex gap-2.5 whitespace-nowrap"
            style={{
              // Nudge alternate rows so the pills never form vertical seams.
              transform: `translateX(${(row % 3) * -7 - 4}rem)`,
            }}
          >
            {quotesInRow.map((quote, i) => (
              <span
                key={`${row}-${i}`}
                className="rounded-full border border-white/[0.07] bg-white/[0.03] px-3.5 py-1.5 font-body text-label font-bold tracking-label uppercase text-ink-dim"
              >
                {quote}
              </span>
            ))}
          </div>
        ))}
      </div>

      {/*
        Darkens the wall towards the edges and under the middle, so the logo
        and the buttons sit on something close to flat surface colour while the
        texture still shows at the corners.
      */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(10,10,12,0.72)_0%,rgba(10,10,12,0.93)_55%,var(--color-surface)_100%)]" />
    </div>
  );
}
