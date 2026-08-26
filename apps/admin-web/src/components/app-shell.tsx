'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Tags,
  Activity,
  Megaphone,
  LifeBuoy,
  Settings,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useSignOut } from '@/features/auth/hooks';

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

/**
 * Match on the first path segment, so /members/<id> keeps "Members" highlighted
 * and /settings/staff keeps "Settings" highlighted. Overview is the only exact
 * match, or it would light up on every page.
 */
function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  const section = href.split('/')[1];
  return section !== undefined && pathname.split('/')[1] === section;
}

const NAV: NavItem[] = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/members', label: 'Members', icon: Users },
  { href: '/payments', label: 'Payments', icon: CreditCard },
  { href: '/plans', label: 'Plans', icon: Tags },
  { href: '/attendance', label: 'Attendance', icon: Activity },
  { href: '/broadcasts', label: 'Broadcasts', icon: Megaphone },
  { href: '/issues', label: 'Issues', icon: LifeBuoy },
  { href: '/settings/hours', label: 'Settings', icon: Settings },
];

export function AppShell({
  gymName,
  fullName,
  role,
  children,
}: {
  gymName: string;
  fullName: string;
  role: 'OWNER' | 'STAFF';
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const signOut = useSignOut();

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-[var(--surface-border)] bg-[var(--surface-card)] md:flex">
        <div className="px-5 py-6">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Urban Gym
          </p>
          <p className="mt-1 truncate text-sm font-semibold">{gymName}</p>
        </div>

        <nav className="flex-1 space-y-0.5 px-3" aria-label="Main">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-[var(--surface-raised)] font-medium text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]',
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[var(--surface-border)] p-3">
          <div className="px-2 pb-2">
            <p className="truncate text-sm font-medium">{fullName}</p>
            <p className="text-xs text-[var(--text-muted)]">{role === 'OWNER' ? 'Owner' : 'Staff'}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              void signOut.mutateAsync().then(() => {
                router.replace('/login');
                router.refresh();
              });
            }}
            className="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* The sidebar collapses below md, so the same destinations need a row here. */}
        <nav
          aria-label="Main"
          className="flex gap-1 overflow-x-auto border-b border-[var(--surface-border)] bg-[var(--surface-card)] px-3 py-2 md:hidden"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs text-[var(--text-muted)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
