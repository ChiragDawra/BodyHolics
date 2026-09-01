"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/cn";

export type Tab = {
  href: string;
  label: string;
  icon: (props: { className?: string; strokeWidth?: number }) => ReactNode;
};

/**
 * Floating frosted tab bar for the phone apps.
 *
 * It sits inset from the edges rather than spanning the full width, so the
 * content behind it stays visible through the blur — the app reads as one
 * surface with a control resting on it, not two stacked bars.
 *
 * `pb-[env(safe-area-inset-bottom)]` on the wrapper is what keeps it above the
 * iOS home indicator.
 */
export function TabBar({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]">
      <nav
        aria-label={strings.common.mainNav}
        className={cn(
          "pointer-events-auto mx-auto mb-4 flex h-16 max-w-md overflow-hidden",
          "mx-3.5 rounded-lg border border-white/[0.07]",
          "bg-surface-overlay/80 backdrop-blur-xl",
        )}
      >
        {tabs.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1.5",
                "font-display text-[0.625rem] font-semibold transition-colors",
                active ? "text-brand" : "text-ink-dim",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute top-0 left-1/2 h-0.5 w-6.5 -translate-x-1/2 rounded-full transition-colors",
                  active ? "bg-brand" : "bg-transparent",
                )}
              />
              <Icon className="h-5.5 w-5.5" strokeWidth={1.8} />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
