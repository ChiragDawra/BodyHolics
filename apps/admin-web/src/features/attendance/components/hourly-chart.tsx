'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/**
 * Arrivals by hour of the gym's day. This is the view that answers "when do we
 * need someone on the floor", which is why it exists separately from the daily
 * totals.
 */
export function HourlyChart({ data }: { data: { hour: number; visits: number }[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" vertical={false} />
          <XAxis
            dataKey="hour"
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval={2}
            tickFormatter={(hour: number) => `${hour}:00`}
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
            labelFormatter={(hour) => {
              const start = typeof hour === 'number' ? hour : 0;
              return `${start}:00 – ${start + 1}:00`;
            }}
            formatter={(value) => {
              const arrivals = typeof value === 'number' ? value : 0;
              return [`${arrivals} arrival${arrivals === 1 ? '' : 's'}`, ''];
            }}
          />
          <Bar dataKey="visits" fill="var(--accent)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
