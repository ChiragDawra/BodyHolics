"use client";

import { useCallback, useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { BellIcon, MegaphoneIcon } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/client";
import { formatRelative } from "@/lib/format";
import { strings } from "@/lib/strings";

export type AlertItem = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

/**
 * Bell in the member header. Shows an unread count, opens the alert list in a
 * Sheet, and subscribes to Realtime so a notice published from the desk lands
 * on a member's phone without a refresh.
 *
 * Unread is tracked in the alert_reads table, not localStorage — Supabase is
 * the source of truth, so the badge is the same on every device the member
 * signs in on.
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

  const markAllRead = useCallback(async () => {
    if (unread.size === 0) return;

    const ids = [...unread];
    setUnread(new Set());

    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return;

    await supabase
      .from("alert_reads")
      .upsert(
        ids.map((alert_id) => ({ alert_id, profile_id: userId })),
        { onConflict: "alert_id,profile_id" },
      );
  }, [unread]);

  const openSheet = () => {
    setOpen(true);
    void markAllRead();
  };

  const count = unread.size;

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        aria-label={
          count > 0
            ? `${strings.member.openAlerts}, ${strings.member.alertsUnread(count)}`
            : strings.member.openAlerts
        }
        className="relative flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-surface-sunken"
      >
        <BellIcon className="h-6 w-6" />
        {count > 0 ? (
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 font-display text-xs font-bold text-on-brand"
          >
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={strings.member.alertsTitle}
      >
        {alerts.length === 0 ? (
          <EmptyState
            icon={<MegaphoneIcon className="h-6 w-6" />}
            title={strings.member.alertsEmpty}
            body={strings.member.alertsEmptyBody}
          />
        ) : (
          <ul className="divide-y divide-border">
            {alerts.map((alert) => (
              <li key={alert.id} className="py-3 first:pt-0 last:pb-0">
                <p className="font-display font-semibold text-ink">{alert.title}</p>
                {alert.body ? (
                  <p className="mt-1 text-sm text-ink-muted">{alert.body}</p>
                ) : null}
                <p className="mt-1.5 text-xs text-ink-muted">
                  {formatRelative(alert.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </>
  );
}
