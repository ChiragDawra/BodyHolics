"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/cn";

export type Tab = {
  href: string;
  label: string;
  icon: (props: { className?: string }) => ReactNode;
};

/**
 * Fixed bottom navigation for the member PWA.
 *
 * `pb-[env(safe-area-inset-bottom)]` is what keeps the labels above the iOS
 * home indicator when the app is installed; without it the bottom row of
 * touch targets sits under the gesture bar.
 */
export function TabBar({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={strings.common.mainNav}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40",
        "border-t border-border bg-surface-raised",
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul className="mx-auto flex max-w-md">
        {tabs.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1",
                  "font-display text-xs font-semibold transition-colors",
                  active ? "text-brand" : "text-ink-muted",
                )}
              >
                <Icon className="h-6 w-6" />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
