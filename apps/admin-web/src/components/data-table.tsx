import { cn } from '@/lib/cn';

/**
 * A table that scrolls inside its own container. The page body must never scroll
 * horizontally, and a members list on a tablet will always be wider than the
 * viewport.
 */
export function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        'border-b border-[var(--surface-border)] px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]',
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn('border-b border-[var(--surface-border)] px-5 py-3 align-middle', className)}
      {...props}
    />
  );
}
