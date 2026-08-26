'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DayCount } from '../types';

/**
 * Thirty days of arrivals.
 *
 * Colours come from CSS custom properties rather than literals so the chart
 * follows the theme — a hardcoded dark bar disappears on a dark background.
 */
export function TrafficChart({ data }: { data: DayCount[] }) {
  return (
    // Recharts needs a bounded parent; the wrapper is what gives it one.
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            // One label per week; thirty dates on a phone-width axis is a smear.
            interval={6}
            tickFormatter={(value: string) => value.slice(8)}
          />
          <YAxis
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={32}
          />
          <Tooltip
            cursor={{ fill: 'var(--surface-raised)' }}
            contentStyle={{
              background: 'var(--surface-card)',
              border: '1px solid var(--surface-border)',
              borderRadius: 10,
              color: 'var(--text-primary)',
              fontSize: 12,
            }}

            formatter={(value) => {
              const visits = typeof value === 'number' ? value : 0;
              return [`${visits} visit${visits === 1 ? '' : 's'}`, ''];
            }}
          />
          <Bar dataKey="visits" fill="var(--accent)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
