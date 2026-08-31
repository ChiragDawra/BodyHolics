import { createClient } from "@/lib/supabase/server";
import { parseWeeklyHours, resolveOpenState, type CrowdLevel, type OpenState } from "@/lib/gym";
import { gymToday } from "@/lib/format";

export type MembershipRow = {
  id: string;
  start_date: string;
  end_date: string;
  status: "active" | "expired" | "cancelled";
  plan_name: string | null;
};

export type MemberSnapshot = {
  profile: {
    id: string;
    gym_id: string;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
    created_at: string;
  };
  gymName: string;
  openState: OpenState;
  crowdLevel: CrowdLevel;
  crowdUpdatedAt: string;
  membership: MembershipRow | null;
  visitsThisMonth: number;
  lastVisitAt: string | null;
};

/**
 * Everything the member home screen needs.
 *
 * RLS means each of these reads is already scoped to the signed-in member;
 * there is no `where profile_id = ...` to forget.
 */
export async function getMemberSnapshot(): Promise<MemberSnapshot | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, gym_id, full_name, email, avatar_url, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;

  const monthStart = `${gymToday().slice(0, 7)}-01`;

  const [gymResult, membershipResult, visitsResult, lastVisitResult] =
    await Promise.all([
      supabase
        .from("gyms")
        .select("name, weekly_hours, is_open_override, crowd_level, crowd_updated_at")
        .eq("id", profile.gym_id)
        .maybeSingle(),
      supabase
        .from("memberships")
        .select("id, start_date, end_date, status, plans(name)")
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
    ]);

  const gym = gymResult.data;

  return {
    profile,
    gymName: gym?.name ?? "",
    openState: resolveOpenState(
      parseWeeklyHours(gym?.weekly_hours),
      gym?.is_open_override ?? null,
    ),
    crowdLevel: gym?.crowd_level ?? "not_crowded",
    crowdUpdatedAt: gym?.crowd_updated_at ?? new Date().toISOString(),
    membership: membershipResult.data
      ? {
          id: membershipResult.data.id,
          start_date: membershipResult.data.start_date,
          end_date: membershipResult.data.end_date,
          status: membershipResult.data.status,
          plan_name: membershipResult.data.plans?.name ?? null,
        }
      : null,
    visitsThisMonth: visitsResult.count ?? 0,
    lastVisitAt: lastVisitResult.data?.checked_in_at ?? null,
  };
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

/** Full attendance history, newest first. */
export async function getMemberAttendance(profileId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("attendance")
    .select("id, checked_in_at")
    .eq("profile_id", profileId)
    .order("checked_in_at", { ascending: false })
    .limit(300);

  return data ?? [];
}
