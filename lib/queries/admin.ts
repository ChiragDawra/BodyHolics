import { createClient } from "@/lib/supabase/server";
import { gymToday } from "@/lib/format";

/**
 * Reads for the admin dashboard.
 *
 * Every one of these is scoped by RLS to gyms the signed-in user is staff at,
 * so none of them carry a gym filter of their own. A non-staff session gets
 * empty results rather than someone else's data.
 */

export async function getStaffGym() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("gyms")
    .select("id, name, slug, join_code, weekly_hours, is_open_override, crowd_level")
    .limit(1)
    .maybeSingle();

  return data;
}

export type MemberListRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
  end_date: string | null;
  status: "active" | "expired" | "cancelled" | null;
  plan_name: string | null;
};

export async function getMembers(gymId: string): Promise<MemberListRow[]> {
  const supabase = await createClient();

  const [profilesResult, membershipsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url, created_at")
      .eq("gym_id", gymId)
      .order("full_name", { ascending: true }),
    supabase
      .from("memberships")
      .select("profile_id, end_date, status, plans(name)")
      .eq("gym_id", gymId)
      .order("end_date", { ascending: false }),
  ]);

  // Newest membership per member. The query is ordered by end_date desc, so
  // the first one seen for a profile is the one that counts.
  const latest = new Map<string, { end_date: string; status: MemberListRow["status"]; plan_name: string | null }>();
  for (const m of membershipsResult.data ?? []) {
    if (latest.has(m.profile_id)) continue;
    latest.set(m.profile_id, {
      end_date: m.end_date,
      status: m.status,
      plan_name: m.plans?.name ?? null,
    });
  }

  return (profilesResult.data ?? []).map((p) => {
    const m = latest.get(p.id);
    return {
      ...p,
      end_date: m?.end_date ?? null,
      status: m?.status ?? null,
      plan_name: m?.plan_name ?? null,
    };
  });
}

export async function getMemberDetail(profileId: string) {
  const supabase = await createClient();

  const [profileResult, membershipsResult, attendanceResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, gym_id, full_name, email, avatar_url, created_at")
      .eq("id", profileId)
      .maybeSingle(),
    supabase
      .from("memberships")
      .select("id, start_date, end_date, status, plans(name)")
      .eq("profile_id", profileId)
      .order("end_date", { ascending: false }),
    supabase
      .from("attendance")
      .select("id, checked_in_at")
      .eq("profile_id", profileId)
      .order("checked_in_at", { ascending: false })
      .limit(100),
  ]);

  if (!profileResult.data) return null;

  return {
    profile: profileResult.data,
    memberships: (membershipsResult.data ?? []).map((m) => ({
      id: m.id,
      start_date: m.start_date,
      end_date: m.end_date,
      status: m.status,
      plan_name: m.plans?.name ?? null,
    })),
    attendance: attendanceResult.data ?? [],
  };
}

export async function getTodayAttendance(gymId: string) {
  const supabase = await createClient();
  const today = gymToday();

  const { data } = await supabase
    .from("attendance")
    .select("id, checked_in_at, profile_id, profiles(full_name, email)")
    .eq("gym_id", gymId)
    .gte("checked_in_at", `${today}T00:00:00+05:30`)
    .lte("checked_in_at", `${today}T23:59:59+05:30`)
    .order("checked_in_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    checked_in_at: row.checked_in_at,
    profile_id: row.profile_id,
    full_name: row.profiles?.full_name ?? null,
    email: row.profiles?.email ?? null,
  }));
}

export async function getPlans(gymId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("plans")
    .select("id, name, price_paise, duration_days, is_active, created_at")
    .eq("gym_id", gymId)
    .order("duration_days", { ascending: true });

  return data ?? [];
}

export async function getAlerts(gymId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("alerts")
    .select("id, title, body, created_at")
    .eq("gym_id", gymId)
    .order("created_at", { ascending: false })
    .limit(50);

  return data ?? [];
}
