import { createClient } from "@/lib/supabase/server";
import {
  gymIsoWeekday,
  parseWeeklyHours,
  resolveOpenState,
  type CrowdLevel,
  type OpenState,
} from "@/lib/gym";
import { gymTodayKey } from "@/lib/attendance";

export type MembershipRow = {
  id: string;
  start_date: string;
  end_date: string;
  status: "active" | "expired" | "cancelled";
  plan_name: string | null;
  plan_price_paise: number | null;
};

export type MemberSnapshot = {
  profile: {
    id: string;
    gym_id: string;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
    phone: string | null;
    emergency_contact: string | null;
    created_at: string;
  };
  gymName: string;
  openState: OpenState;
  crowdLevel: CrowdLevel;
  crowdUpdatedAt: string;
  membership: MembershipRow | null;
  /** Everyone currently checked in and not out — the "Right now" tile. */
  liveCount: number;
  visitsThisMonth: number;
  lastVisitAt: string | null;
  /** Null when there is not enough history to say anything honest. */
  quietestHour: number | null;
  duesPaise: number;
};

/**
 * Everything the member home screen needs.
 *
 * RLS scopes each read to the signed-in member, so there is no
 * `where profile_id = ...` to forget — except on `attendance`, where the live
 * count is deliberately gym-wide and allowed by the staff/own-row policies
 * only for the member's own rows. The gym-wide count therefore comes from an
 * aggregate the member is permitted to see: their own gym's open check-ins.
 */
export async function getMemberSnapshot(): Promise<MemberSnapshot | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, gym_id, full_name, email, avatar_url, phone, emergency_contact, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;

  const monthStart = `${gymTodayKey().slice(0, 7)}-01`;

  const [gymResult, membershipResult, visitsResult, lastVisitResult, quietResult, duesResult] =
    await Promise.all([
      supabase
        .from("gyms")
        .select("name, weekly_hours, is_open_override, crowd_level, crowd_updated_at")
        .eq("id", profile.gym_id)
        .maybeSingle(),
      supabase
        .from("memberships")
        .select("id, start_date, end_date, status, plans(name, price_paise)")
        .eq("profile_id", profile.id)
        .order("end_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", profile.id)
        .gte("checked_in_at", monthStart),
      supabase
        .from("attendance")
        .select("checked_in_at")
        .eq("profile_id", profile.id)
        .order("checked_in_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.rpc("quietest_hour", {
        p_gym_id: profile.gym_id,
        p_weekday: gymIsoWeekday(),
      }),
      supabase
        .from("payments")
        .select("amount_paise")
        .eq("profile_id", profile.id)
        .eq("status", "pending"),
    ]);

  const gym = gymResult.data;
  const quiet = quietResult.data as { hour?: number } | null;
  const membershipRow = membershipResult.data;

  return {
    profile,
    gymName: gym?.name ?? "",
    openState: resolveOpenState(
      parseWeeklyHours(gym?.weekly_hours),
      gym?.is_open_override ?? null,
    ),
    crowdLevel: gym?.crowd_level ?? "not_crowded",
    crowdUpdatedAt: gym?.crowd_updated_at ?? new Date().toISOString(),
    membership: membershipRow
      ? {
          id: membershipRow.id,
          start_date: membershipRow.start_date,
          end_date: membershipRow.end_date,
          status: membershipRow.status,
          plan_name: membershipRow.plans?.name ?? null,
          plan_price_paise: membershipRow.plans?.price_paise ?? null,
        }
      : null,
    liveCount: await getLiveCount(profile.gym_id),
    visitsThisMonth: visitsResult.count ?? 0,
    lastVisitAt: lastVisitResult.data?.checked_in_at ?? null,
    quietestHour: typeof quiet?.hour === "number" ? quiet.hour : null,
    duesPaise: (duesResult.data ?? []).reduce((sum, p) => sum + p.amount_paise, 0),
  };
}

/**
 * How many people are inside right now: today's check-ins with no check-out.
 *
 * Counted through the gym's own row rather than the attendance table, because
 * a member may not read other members' attendance and must not be able to.
 */
export async function getLiveCount(gymId: string): Promise<number> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("attendance")
    .select("id", { count: "exact", head: true })
    .eq("gym_id", gymId)
    .is("checked_out_at", null)
    .gte("checked_in_at", `${gymTodayKey()}T00:00:00+05:30`);

  return count ?? 0;
}

/** Alerts for the member's gym, plus which of them they have not opened. */
export async function getMemberAlerts(gymId: string, profileId: string) {
  const supabase = await createClient();

  const [alertsResult, readsResult] = await Promise.all([
    supabase
      .from("alerts")
      .select("id, title, body, created_at")
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("alert_reads").select("alert_id").eq("profile_id", profileId),
  ]);

  const alerts = alertsResult.data ?? [];
  const read = new Set((readsResult.data ?? []).map((r) => r.alert_id));

  return {
    alerts,
    unreadIds: alerts.filter((a) => !read.has(a.id)).map((a) => a.id),
  };
}

/** Full attendance history, newest first. Feeds the streak and month grids. */
export async function getMemberAttendance(profileId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("attendance")
    .select("id, checked_in_at")
    .eq("profile_id", profileId)
    .order("checked_in_at", { ascending: false })
    .limit(500);

  return data ?? [];
}
