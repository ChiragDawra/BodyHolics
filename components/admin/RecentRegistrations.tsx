"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { UsersIcon } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/client";
import { formatRelative } from "@/lib/format";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/cn";

export type Registration = {
  id: string;
  full_name: string | null;
  created_at: string;
};

/**
 * New members, live.
 *
 * Subscribed to Realtime because this is the one number on the dashboard that
 * changes while the owner is looking at it — someone signing up at the desk
 * should appear without a refresh. A row that arrives this way gets a green
 * flash that decays over 2.4s, so it is obvious which one is new without a
 * badge that then has to be cleared.
 */
export function RecentRegistrations({
  gymId,
  initial,
  weekCount,
}: {
  gymId: string;
  initial: Registration[];
  weekCount: number;
}) {
  const [rows, setRows] = useState<Registration[]>(initial);
  const [live, setLive] = useState<Set<string>>(new Set());
  const [thisWeek, setThisWeek] = useState(weekCount);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`profiles:${gymId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "profiles",
          filter: `gym_id=eq.${gymId}`,
        },
        (payload) => {
          const row = payload.new as Registration;
          setRows((prev) =>
            prev.some((r) => r.id === row.id) ? prev : [row, ...prev].slice(0, 5),
          );
          setLive((prev) => new Set(prev).add(row.id));
          setThisWeek((n) => n + 1);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [gymId]);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<UsersIcon className="h-6 w-6" />}
        title={strings.admin.dashboard.noRegistrations}
        body={strings.admin.dashboard.noRegistrationsBody}
      />
    );
  }

  return (
    <>
      <ul>
        {rows.map((row) => (
          <li
            key={row.id}
            className={cn(
              "flex items-center justify-between gap-3 border-t border-border-soft py-3",
              live.has(row.id) && "bh-flash",
            )}
          >
            <span className="truncate text-sm font-medium text-ink">
              {row.full_name ?? ""}
            </span>
            <span
              className={cn(
                "shrink-0 text-xs",
                live.has(row.id) ? "text-success" : "text-ink-dim",
              )}
            >
              {formatRelative(row.created_at)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-dim">
        {strings.admin.dashboard.registrationsThisWeek(thisWeek)}
      </p>
    </>
  );
}
