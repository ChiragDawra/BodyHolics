import Link from 'next/link';
import { requireStaffSession } from '@/lib/session';

const TABS = [
  { href: '/settings/hours', label: 'Opening hours' },
  { href: '/settings/staff', label: 'Staff' },
  { href: '/settings/audit', label: 'Audit log' },
] as const;

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireStaffSession();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
      </header>

      <nav aria-label="Settings" className="flex flex-wrap gap-2 border-b border-[var(--surface-border)] pb-3">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="rounded-[var(--radius-md)] px-3 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
