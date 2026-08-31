"use client";

// The tab list holds icon *components*, which cannot be serialised across
// the server/client boundary. Defining it inside a client module keeps them
// on one side of that line.
import { TabBar, type Tab } from "@/components/ui/TabBar";
import { ActivityIcon, HomeIcon, UserIcon } from "@/components/ui/icons";
import { strings } from "@/lib/strings";

const TABS: Tab[] = [
  { href: "/app", label: strings.member.tabs.home, icon: HomeIcon },
  { href: "/app/activity", label: strings.member.tabs.activity, icon: ActivityIcon },
  { href: "/app/me", label: strings.member.tabs.me, icon: UserIcon },
];

export function MemberTabBar() {
  return <TabBar tabs={TABS} />;
}
