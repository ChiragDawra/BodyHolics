"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarIcon,
  MegaphoneIcon,
  SettingsIcon,
  TagIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/admin/members", label: strings.admin.nav.members, icon: UsersIcon },
  { href: "/admin/attendance", label: strings.admin.nav.attendance, icon: CalendarIcon },
  { href: "/admin/plans", label: strings.admin.nav.plans, icon: TagIcon },
  { href: "/admin/settings", label: strings.admin.nav.settings, icon: SettingsIcon },
  { href: "/admin/alerts", label: strings.admin.nav.alerts, icon: MegaphoneIcon },
];

/**
 * Desktop-first navigation. On a narrow screen it collapses to a horizontal
 * scrolling strip rather than a hamburger — the owner opens this on a laptop,
 * and a phone visit is a glance, not a session.
 */
export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label={strings.common.dashboardNav}
      className={cn(
        "border-border bg-surface-raised",
        "flex gap-1 overflow-x-auto border-b p-2",
        "md:h-dvh md:w-60 md:shrink-0 md:flex-col md:overflow-visible md:border-b-0 md:border-r md:p-3",
      )}
    >
      <span className="hidden px-3 pb-4 pt-2 font-display text-lg font-bold text-ink md:block">
        {strings.app.name}
      </span>

      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2.5",
              "font-display text-sm font-semibold transition-colors",
              active
                ? "bg-brand-subtle text-brand"
                : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
