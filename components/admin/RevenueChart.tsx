import type { MonthlyRevenue } from "@/lib/queries/admin";
import { strings } from "@/lib/strings";

/**
 * Six months of collected revenue as a single line.
 *
 * Hand-drawn SVG rather than a charting library: it is six points on one
 * series, and a chart dependency would be more code than this, plus a second
 * theming system to keep in sync with the tokens.
 *
 * `stroke` and gridlines use currentColor / token classes so the line follows
 * the palette rather than hard-coding the accent.
 */
export function RevenueChart({ months }: { months: MonthlyRevenue[] }) {
  const values = months.map((m) => m.collectedPaise);
  const peak = Math.max(...values, 1);

  // Round the axis up to a clean number so the gridlines mean something.
  const step = Math.max(1, Math.ceil(peak / 300_000)) * 100_000;
  const ceiling = Math.ceil(peak / step) * step || step;

  const width = 900;
  const height = 150;
  const points = months.map((m, i) => {
    const x = months.length === 1 ? width : (i / (months.length - 1)) * (width - 60) + 60;
    const y = height - 8 - (m.collectedPaise / ceiling) * (height - 24);
    return { x, y, month: m };
  });

  const last = points[points.length - 1];
  const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const axis = [ceiling, ceiling * 0.66, ceiling * 0.33, 0];

  return (
    <div className="flex gap-3.5">
      <div className="flex flex-none flex-col justify-between py-0.5 font-mono text-label text-ink-faint">
        {axis.map((v) => (
          <span key={v}>{shortRupees(v)}</span>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={strings.admin.dashboard.revenueTrend}
          className="block h-37.5 w-full"
        >
          {[0, 50, 100].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2={width}
              y2={y}
              className="stroke-border-soft"
              strokeWidth="1"
            />
          ))}
          <line
            x1="0"
            y1={height - 1}
            x2={width}
            y2={height - 1}
            className="stroke-border"
            strokeWidth="1"
          />
          <polyline
            points={polyline}
            fill="none"
            className="stroke-brand"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="1600"
            style={{ animation: "bh-draw 1.2s cubic-bezier(.4,0,.2,1) both" }}
          />
          {last ? <circle cx={last.x} cy={last.y} r="4.5" className="fill-brand" /> : null}
        </svg>

        <div
          className="mt-2.5 grid text-xs text-ink-dim"
          style={{ gridTemplateColumns: `repeat(${months.length}, 1fr)` }}
        >
          {months.map((m, i) => (
            <span
              key={m.monthKey}
              className={i === months.length - 1 ? "text-ink-muted" : undefined}
            >
              {m.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Bar version, used on the Revenue page's side panel. */
export function RevenueBars({ months }: { months: MonthlyRevenue[] }) {
  const peak = Math.max(...months.map((m) => m.collectedPaise), 1);

  return (
    <div className="flex h-42 items-end gap-2.5">
      {months.map((m, i) => {
        const pct = Math.max(2, Math.round((m.collectedPaise / peak) * 100));
        const isLast = i === months.length - 1;
        return (
          <span key={m.monthKey} className="flex flex-1 flex-col items-center gap-2.5">
            <span
              style={{ height: `${pct}%`, animationDelay: `${i * 60}ms` }}
              className={`w-full origin-bottom rounded-t-sm animate-[bh-grow_0.7s_cubic-bezier(0.22,1,0.36,1)_both] ${
                isLast ? "bg-brand" : "bg-surface-high"
              }`}
            />
            <span className="text-label text-ink-dim">{m.label}</span>
          </span>
        );
      })}
    </div>
  );
}

/** 150000000 paise -> "₹15.0L". Indian units, because the owner thinks in lakhs. */
function shortRupees(paise: number): string {
  const rupees = paise / 100;
  if (rupees === 0) return "0";
  if (rupees >= 100_000) return `₹${(rupees / 100_000).toFixed(1)}L`;
  if (rupees >= 1_000) return `₹${Math.round(rupees / 1_000)}k`;
  return `₹${Math.round(rupees)}`;
}
