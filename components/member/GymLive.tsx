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
  resolveCrowdLevel,
  resolveOpenState,
  type CrowdLevel,
  type CrowdSlot,
  type CrowdState,
  type HourBlock,
  type OpenState,
} from "@/lib/gym";

/**
 * Open/closed and crowd, live.
 *
 * The owner flips the gym closed from the desk and every member looking at
 * their phone sees it, with no refresh. That is the whole point of the two
 * tiles at the top of the home screen — a status that needs a pull-to-refresh
 * to be true is not a status, it is a cached opinion.
 *
 * Realtime applies RLS to what it streams, and all three tables here are
 * world-readable, so this works signed in on /app and signed out on the
 * landing page alike.
 */

export type GymSnapshot = {
  hourBlocks: HourBlock[];
  crowdSlots: CrowdSlot[];
  isOpenOverride: boolean | null;
  crowdOverride: CrowdLevel | null;
};

type LiveGym = { openState: OpenState; crowd: CrowdState };

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
  const initialKey = JSON.stringify(initial);
  const [seenKey, setSeenKey] = useState(initialKey);
  const [live, setLive] = useState<GymSnapshot | null>(null);

  if (seenKey !== initialKey) {
    setSeenKey(initialKey);
    setLive(null);
  }

  const snapshot = live ?? initial;

  /**
   * The gym also opens and closes because time passed, not because anyone
   * touched a control — and with a split schedule that now happens four
   * times a day, plus every boundary in the crowd timetable.
   *
   * Undefined until the first tick so the server render and the hydration
   * render agree; both resolvers fall back to their own `new Date()`.
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
      /**
       * The overrides are the ones that have to be instant — this is the desk
       * flipping the gym closed in front of a queue — so they are applied
       * straight from the payload rather than waiting for a refetch.
       */
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
            is_open_override?: boolean | null;
            crowd_override?: CrowdLevel | null;
          };

          setLive((prev) => ({
            ...(prev ?? initial),
            isOpenOverride: row.is_open_override ?? null,
            crowdOverride: row.crowd_override ?? null,
          }));

          // Everything else on the screen the same change can affect.
          router.refresh();
        },
      )
      /**
       * Schedule edits are rare and arrive one row at a time, so rebuilding
       * the whole list from a payload would be more code than it is worth.
       * A refresh re-renders the server component with the new schedule, and
       * the `initialKey` comparison above then retires the live row.
       */
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gym_hour_blocks" },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crowd_schedule" },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // `initial` is only read inside the handler as a fallback for the very
    // first event; re-subscribing whenever it changes identity would tear the
    // channel down on every server render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gymId, router]);

  const value = useMemo<LiveGym>(
    () => ({
      openState: resolveOpenState(
        snapshot.hourBlocks,
        snapshot.isOpenOverride,
        now,
      ),
      crowd: resolveCrowdLevel(
        snapshot.crowdSlots,
        snapshot.crowdOverride,
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
  return <CrowdMeter level={useGym().crowd.level} />;
}
