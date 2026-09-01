"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ActivityIcon,
  CalendarIcon,
  MegaphoneIcon,
  SettingsIcon,
  TagIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/admin", label: strings.admin.nav.dashboard, icon: ActivityIcon, exact: true },
  { href: "/admin/members", label: strings.admin.nav.members, icon: UsersIcon },
  { href: "/admin/revenue", label: strings.admin.nav.revenue, icon: TagIcon },
  { href: "/admin/attendance", label: strings.admin.nav.attendance, icon: CalendarIcon },
  { href: "/admin/alerts", label: strings.admin.nav.alerts, icon: MegaphoneIcon },
  { href: "/admin/settings", label: strings.admin.nav.settings, icon: SettingsIcon },
];

/**
 * Desktop sidebar.
 *
 * Hidden below 640px, where the phone tab bar takes over instead — six items
 * do not fit on a phone and the owner is not doing sidebar work one-handed.
 * Between 640 and 1024 it collapses to icons.
 */
export function AdminSidebar({
  name,
  email,
}: {
  name: string | null;
  email: string | null;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col justify-between border-r border-border-soft",
        "sm:flex sm:w-16 sm:px-2 lg:w-58 lg:px-4",
        "h-dvh sticky top-0 py-6",
      )}
    >
      <div>
        <p className="mb-6 px-2.5 font-display text-[1.0625rem] font-bold tracking-tight text-ink">
          <span className="hidden lg:inline">{strings.app.name}</span>
          <span aria-hidden className="lg:hidden">
            B
          </span>
        </p>

        <nav aria-label={strings.common.dashboardNav} className="flex flex-col gap-0.5">
          {LINKS.map(({ href, label, icon: Icon, exact }) => {
            const active = exact
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                title={label}
                className={cn(
                  "flex items-center gap-3 rounded-sm px-2.5 py-2.5",
                  "font-body text-sm font-medium transition-colors",
                  "justify-center lg:justify-start",
                  active
                    ? "bg-surface-overlay text-ink"
                    : "text-ink-dim hover:bg-surface-raised hover:text-ink-muted",
                )}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" strokeWidth={1.8} />
                <span className="hidden lg:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-3 border-t border-border-soft px-1 pt-3">
        <span
          aria-hidden
          className="flex h-8.5 w-8.5 flex-none items-center justify-center rounded-full border border-border bg-surface-overlay font-display text-sm font-bold text-ink-muted"
        >
          {(name ?? email ?? "?").charAt(0).toUpperCase()}
        </span>
        <div className="hidden min-w-0 lg:block">
          <p className="truncate text-sm font-medium text-ink">{name ?? ""}</p>
          <p className="truncate text-xs text-ink-dim">{strings.admin.roleLabel}</p>
        </div>
      </div>
    </aside>
  );
}
