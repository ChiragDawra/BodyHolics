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
 * Which tab owns the current URL.
 *
 * Prefix matching alone lights up every ancestor: on /app/me the Home tab
 * (/app) matches `startsWith("/app/")` too, so two tabs read as current. The
 * most specific matching tab wins instead, which is the one the member
 * actually navigated to.
 */
function activeHref(tabs: Tab[], pathname: string): string | null {
  let best: string | null = null;

  for (const tab of tabs) {
    if (pathname !== tab.href && !pathname.startsWith(`${tab.href}/`)) continue;
    if (best === null || tab.href.length > best.length) best = tab.href;
  }

  return best;
}

/**
 * A floating capsule, inset from both edges.
 *
 * Not a bar. A full-width bar cuts the screen in two and claims to be part of
 * the app's structure; this rests on top of the content, which stays visible
 * through the blur, so the app reads as one surface with a control on it.
 *
 * Only the current tab carries colour. No pill, no fill, no underline behind
 * the active item — on a capsule this small a second shape inside the first
 * is noise, and colour alone is unambiguous when there are three of them.
 * (Colour is not the *only* signal: `aria-current` carries it for anyone not
 * seeing the colour.)
 *
 * `pb-[env(safe-area-inset-bottom)]` on the wrapper is what keeps it clear of
 * the iPhone home indicator.
 */
export function TabBar({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();
  const current = activeHref(tabs, pathname);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]">
      <nav
        aria-label={strings.common.mainNav}
        className={cn(
          "pointer-events-auto mx-[10%] mb-4 flex h-16 max-w-sm items-stretch sm:mx-auto",
          "rounded-full border border-white/[0.08]",
          "bg-surface-overlay/70 backdrop-blur-xl",
          "shadow-[0_8px_30px_rgba(0,0,0,0.45)]",
        )}
      >
        {tabs.map((tab) => {
          const active = tab.href === current;
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1",
                "rounded-full font-display text-label font-semibold transition-colors",
                active ? "text-brand" : "text-ink-dim",
              )}
            >
              <Icon className="h-5.5 w-5.5" strokeWidth={active ? 2.1 : 1.8} />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
