"use client";

import { TabBar, type Tab } from "@/components/ui/TabBar";
import { ActivityIcon, SettingsIcon, UsersIcon } from "@/components/ui/icons";
import { strings } from "@/lib/strings";

/**
 * The admin on a phone.
 *
 * Three tabs instead of six links: Dashboard, Members, More. The owner on a
 * phone is checking a number or flipping the gym open — everything heavier
 * (revenue tables, plan editing, staff) lives behind More and is really meant
 * for the laptop. Cramming a six-item sidebar onto a 375px screen would make
 * the quick things slower without making the heavy things usable.
 *
 * Hidden at 640px and up, where the real sidebar takes over.
 */
const TABS: Tab[] = [
  { href: "/admin", label: strings.admin.nav.dashboard, icon: ActivityIcon },
  { href: "/admin/members", label: strings.admin.nav.members, icon: UsersIcon },
  { href: "/admin/more", label: strings.admin.nav.more, icon: SettingsIcon },
];

export function AdminTabBar() {
  return (
    <div className="sm:hidden">
      <TabBar tabs={TABS} />
    </div>
  );
}
