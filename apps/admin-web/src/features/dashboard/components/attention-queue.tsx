import Link from 'next/link';
import { CalendarClock, CreditCard, LifeBuoy } from 'lucide-react';
import { Card, CardHeader, CardTitle, EmptyState } from '@/components/ui';
import type { AttentionItem } from '../types';

const ICONS = {
  EXPIRING: CalendarClock,
  PENDING_PAYMENT: CreditCard,
  OPEN_ISSUE: LifeBuoy,
} as const;

export function AttentionQueue({ items }: { items: AttentionItem[] }) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle>Needs attention</CardTitle>
        <span className="numeric text-xs text-[var(--text-muted)]">{items.length}</span>
      </CardHeader>

      {items.length === 0 ? (
        <EmptyState title="Nothing waiting" hint="No expiring memberships, pending payments or unacknowledged issues." />
      ) : (
        <ul className="divide-y divide-[var(--surface-border)] border-t border-[var(--surface-border)]">
          {items.map((item) => {
            const Icon = ICONS[item.kind];
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--surface-raised)]"
                >
                  <Icon className="size-4 shrink-0 text-[var(--text-muted)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{item.title}</span>
                    <span className="block truncate text-sm text-[var(--text-muted)]">{item.detail}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
