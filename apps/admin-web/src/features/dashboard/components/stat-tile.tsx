import { cn } from '@/lib/cn';

/**
 * One number, one label, and — where it exists — one thing to do about it.
 * A tile without a `hint` is a fact; a tile with one is a prompt.
 */
export function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'neutral' | 'positive' | 'warning' | 'danger';
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--surface-border)] bg-[var(--surface-card)] p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      <p
        className={cn(
          'numeric mt-2 text-3xl font-semibold tracking-tight',
          tone === 'positive' && 'text-accent-600',
          tone === 'warning' && 'text-warning-700',
          tone === 'danger' && 'text-danger-500',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-sm text-[var(--text-muted)]">{hint}</p> : null}
    </div>
  );
}
