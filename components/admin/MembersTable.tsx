"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChevronRightIcon, SearchIcon, UsersIcon } from "@/components/ui/icons";
import type { MemberListRow } from "@/lib/queries/admin";
import { daysUntil, formatDay } from "@/lib/format";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/cn";

type Filter = "all" | "active" | "expired";

function isActive(m: MemberListRow): boolean {
  return m.status === "active" && m.end_date !== null && daysUntil(m.end_date) >= 0;
}

export function MembersTable({ members }: { members: MemberListRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return members.filter((m) => {
      if (filter === "active" && !isActive(m)) return false;
      if (filter === "expired" && isActive(m)) return false;
      if (needle === "") return true;

      return (
        (m.full_name ?? "").toLowerCase().includes(needle) ||
        (m.email ?? "").toLowerCase().includes(needle)
      );
    });
  }, [members, query, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">{strings.admin.members.search}</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={strings.admin.members.search}
            className="w-full rounded-md border border-border bg-surface-raised py-2.5 pl-10 pr-3 text-ink placeholder:text-ink-muted"
          />
        </label>

        <div className="flex gap-1 rounded-md border border-border bg-surface-raised p-1">
          {(["all", "active", "expired"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={cn(
                "rounded-sm px-3 py-1.5 font-display text-sm font-semibold transition-colors",
                filter === value
                  ? "bg-brand-subtle text-brand"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              {value === "all"
                ? strings.admin.members.filterAll
                : value === "active"
                  ? strings.admin.members.filterActive
                  : strings.admin.members.filterExpired}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-ink-muted">
        {strings.admin.members.count(visible.length)}
      </p>

      {members.length === 0 ? (
        <EmptyState
          icon={<UsersIcon className="h-6 w-6" />}
          title={strings.admin.members.empty}
          body={strings.admin.members.emptyBody}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<SearchIcon className="h-6 w-6" />}
          title={strings.admin.members.noMatch}
          body={strings.admin.members.noMatchBody}
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border">
            {visible.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/admin/members/${m.id}`}
                  className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-sunken"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display font-semibold text-ink">
                      {m.full_name ?? m.email ?? ""}
                    </p>
                    <p className="truncate text-sm text-ink-muted">
                      {m.email ?? strings.admin.members.joined(formatDay(m.created_at))}
                    </p>
                  </div>

                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="text-sm text-ink">{m.plan_name ?? ""}</p>
                    {m.end_date ? (
                      <p className="text-xs text-ink-muted">
                        {formatDay(m.end_date)}
                      </p>
                    ) : null}
                  </div>

                  <Badge tone={isActive(m) ? "success" : m.status === null ? "neutral" : "danger"}>
                    {isActive(m)
                      ? strings.member.membershipActive
                      : m.status === null
                        ? strings.member.noMembership
                        : strings.member.membershipExpired}
                  </Badge>

                  <ChevronRightIcon className="h-5 w-5 shrink-0 text-ink-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
