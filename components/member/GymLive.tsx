"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { HeroStatus } from "@/components/member/HeroStatus";
import { CrowdMeter } from "@/components/member/CrowdMeter";
import {
  parseWeeklyHours,
  resolveOpenState,
  type CrowdLevel,
  type OpenState,
  type WeeklyHours,
} from "@/lib/gym";

/**
 * Open/closed and crowd, live.
 *
 * The owner flips the gym closed from the desk and every member looking at
 * their phone sees it, with no refresh. That is the whole point of the two
 * tiles at the top of the home screen — a status that needs a pull-to-refresh
 * to be true is not a status, it is a cached opinion.
 *
 * The subscription is `postgres_changes` on the single `gyms` row. Realtime
 * applies RLS to what it streams, and `gyms` is world-readable, so this works
 * signed in on /app and signed out on the landing page alike.
 *
 * One provider per screen, not one per tile: two components subscribing to the
 * same table would open two channels for the same row.
 */

export type GymSnapshot = {
  weeklyHours: WeeklyHours;
  isOpenOverride: boolean | null;
  crowdLevel: CrowdLevel;
};

type LiveGym = GymSnapshot & { openState: OpenState };

const GymContext = createContext<LiveGym | null>(null);

function useGym(): LiveGym {
  const value = useContext(GymContext);
  if (!value) {
    throw new Error("LiveHeroStatus and LiveCrowdMeter need a GymLiveProvider");
  }
  return value;
}

export function GymLiveProvider({
  gymId,
  initial,
  children,
}: {
  gymId: string;
  initial: GymSnapshot;
  children: ReactNode;
}) {
  const router = useRouter();

  /**
   * Two sources of truth, in priority order: whatever the last realtime
   * event carried, falling back to what the server rendered.
   *
   * `initial` is a fresh object on every render, so it cannot be an effect
   * dependency. It is compared by value instead, and a genuinely different
   * server render clears the live row — otherwise a change missed while the
   * socket was disconnected would be masked forever by a stale event.
   */
  const initialKey = JSON.stringify([
    initial.weeklyHours,
    initial.isOpenOverride,
    initial.crowdLevel,
  ]);
  const [seenKey, setSeenKey] = useState(initialKey);
  const [live, setLive] = useState<GymSnapshot | null>(null);

  if (seenKey !== initialKey) {
    setSeenKey(initialKey);
    setLive(null);
  }

  const snapshot = live ?? initial;

  /**
   * The gym also opens and closes because time passed, not because anyone
   * touched a control. Re-resolving every minute keeps the word honest
   * through 10pm without a refresh.
   *
   * Undefined until the first tick so the server render and the hydration
   * render agree; `resolveOpenState` falls back to its own `new Date()`.
   */
  const [now, setNow] = useState<Date>();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`gym-status-${gymId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "gyms",
          filter: `id=eq.${gymId}`,
        },
        (payload) => {
          const row = payload.new as {
            weekly_hours?: unknown;
            is_open_override?: boolean | null;
            crowd_level?: CrowdLevel;
          };

          setLive({
            weeklyHours: parseWeeklyHours(row.weekly_hours),
            isOpenOverride: row.is_open_override ?? null,
            crowdLevel: row.crowd_level ?? "not_crowded",
          });

          // The tiles are already correct from the payload. This refreshes
          // everything else on the screen that the same change can affect.
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [gymId, router]);

  const value = useMemo<LiveGym>(
    () => ({
      ...snapshot,
      openState: resolveOpenState(
        snapshot.weeklyHours,
        snapshot.isOpenOverride,
        now,
      ),
    }),
    [snapshot, now],
  );

  return <GymContext.Provider value={value}>{children}</GymContext.Provider>;
}

export function LiveHeroStatus() {
  return <HeroStatus state={useGym().openState} />;
}

export function LiveCrowdMeter() {
  return <CrowdMeter level={useGym().crowdLevel} />;
}
