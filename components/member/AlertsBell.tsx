"use client";

import { useCallback, useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { BellIcon, MegaphoneIcon } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/client";
import { markAlertsRead } from "@/lib/actions/profile";
import { formatRelative } from "@/lib/format";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/cn";

export type AlertItem = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

/**
 * Bell in the member header. A dot rather than a count — the design uses
 * presence, not arithmetic, because "3" invites you to count and "unread"
 * only needs to say yes or no.
 *
 * Subscribes to Realtime so a notice published from the desk lands on a
 * member's phone without a refresh. Read state lives in alert_reads, not
 * localStorage, so it is the same on every device the member signs in on.
 */
export function AlertsBell({
  gymId,
  initialAlerts,
  initialUnreadIds,
}: {
  gymId: string;
  initialAlerts: AlertItem[];
  initialUnreadIds: string[];
}) {
  const [alerts, setAlerts] = useState<AlertItem[]>(initialAlerts);
  const [unread, setUnread] = useState<Set<string>>(new Set(initialUnreadIds));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`alerts:${gymId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "alerts",
          filter: `gym_id=eq.${gymId}`,
        },
        (payload) => {
          const row = payload.new as AlertItem;
          setAlerts((prev) =>
            prev.some((a) => a.id === row.id) ? prev : [row, ...prev],
          );
          setUnread((prev) => new Set(prev).add(row.id));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [gymId]);

  const openSheet = useCallback(() => {
    setOpen(true);
    if (unread.size === 0) return;
    const ids = [...unread];
    setUnread(new Set());
    void markAlertsRead(ids);
  }, [unread]);

  const hasUnread = unread.size > 0;

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        aria-label={
          hasUnread
            ? `${strings.member.openAlerts}, ${strings.member.unreadCount(unread.size)}`
            : strings.member.openAlerts
        }
        className="relative flex h-11 w-11 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-raised"
      >
        <BellIcon className="h-5.5 w-5.5" strokeWidth={1.8} />
        {hasUnread ? (
          <span
            aria-hidden
            className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-brand ring-2 ring-surface"
          />
        ) : null}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={strings.member.alertsTitle}>
        {alerts.length === 0 ? (
          <EmptyState
            icon={<MegaphoneIcon className="h-6 w-6" />}
            title={strings.member.alertsEmpty}
            body={strings.member.alertsEmptyBody}
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {alerts.map((alert, i) => {
              // The newest alert carries the accent edge; older ones fade back.
              const lead = i === 0;
              return (
                <li
                  key={alert.id}
                  className={cn(
                    "rounded-r-md bg-surface-overlay px-4 py-3.5 border-l-4",
                    lead ? "border-l-brand" : "border-l-border",
                  )}
                >
                  <p
                    className={cn(
                      "font-display font-bold",
                      lead ? "text-ink" : "text-ink-muted",
                    )}
                  >
                    {alert.title}
                  </p>
                  {alert.body ? (
                    <p
                      className={cn(
                        "mt-1.5 text-sm leading-relaxed",
                        lead ? "text-ink-muted" : "text-ink-dim",
                      )}
                    >
                      {alert.body}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-ink-dim">
                    {formatRelative(alert.created_at)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Sheet>
    </>
  );
}
