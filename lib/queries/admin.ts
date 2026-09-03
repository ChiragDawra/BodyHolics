import { createClient } from "@/lib/supabase/server";
import { gymTodayKey } from "@/lib/attendance";

/**
 * Reads for the admin dashboard.
 *
 * Every one of these is scoped by RLS to gyms the signed-in user is staff at,
 * so none of them carry a gym filter of their own beyond the id they are
 * handed. A non-staff session gets empty results rather than someone else's
 * data.
 */

export async function getStaffGym() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("gyms")
    .select("id, name, slug, join_code, is_open_override, crowd_override, crowd_updated_at")
    .limit(1)
    .maybeSingle();

  return data;
}

export type MemberListRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  emergency_contact: string | null;
  avatar_url: string | null;
  created_at: string;
  end_date: string | null;
  status: "active" | "expired" | "cancelled" | null;
  plan_name: string | null;
  duesPaise: number;
};

export async function getMembers(gymId: string): Promise<MemberListRow[]> {
  const supabase = await createClient();

  const [profilesResult, membershipsResult, duesResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, phone, emergency_contact, avatar_url, created_at")
      .eq("gym_id", gymId)
      .order("full_name", { ascending: true }),
    supabase
      .from("memberships")
      .select("profile_id, end_date, status, plans(name)")
      .eq("gym_id", gymId)
      .order("end_date", { ascending: false }),
    supabase
      .from("payments")
      .select("profile_id, amount_paise")
      .eq("gym_id", gymId)
      .eq("status", "pending"),
  ]);

  // Newest membership per member. The query is ordered by end_date desc, so
  // the first one seen for a profile is the one that counts.
  const latest = new Map<
    string,
    { end_date: string; status: MemberListRow["status"]; plan_name: string | null }
  >();
  for (const m of membershipsResult.data ?? []) {
    if (latest.has(m.profile_id)) continue;
    latest.set(m.profile_id, {
      end_date: m.end_date,
      status: m.status,
      plan_name: m.plans?.name ?? null,
    });
  }

  const dues = new Map<string, number>();
  for (const p of duesResult.data ?? []) {
    dues.set(p.profile_id, (dues.get(p.profile_id) ?? 0) + p.amount_paise);
  }

  return (profilesResult.data ?? []).map((p) => {
    const m = latest.get(p.id);
    return {
      ...p,
      end_date: m?.end_date ?? null,
      status: m?.status ?? null,
      plan_name: m?.plan_name ?? null,
      duesPaise: dues.get(p.id) ?? 0,
    };
  });
}

/** Membership history and 30-day attendance for the detail panel. */
export async function getMemberDetail(profileId: string) {
  const supabase = await createClient();

  const [membershipsResult, attendanceResult] = await Promise.all([
    supabase
      .from("memberships")
      .select("id, start_date, end_date, status, plans(name, price_paise)")
      .eq("profile_id", profileId)
      .order("end_date", { ascending: false })
      .limit(10),
    supabase
      .from("attendance")
      .select("id, checked_in_at")
      .eq("profile_id", profileId)
      .gte("checked_in_at", new Date(Date.now() - 31 * 86_400_000).toISOString())
      .order("checked_in_at", { ascending: false }),
  ]);

  return {
    memberships: (membershipsResult.data ?? []).map((m) => ({
      id: m.id,
      start_date: m.start_date,
      end_date: m.end_date,
      status: m.status,
      plan_name: m.plans?.name ?? null,
      price_paise: m.plans?.price_paise ?? null,
    })),
    attendance: attendanceResult.data ?? [],
  };
}

export type TodayRow = {
  id: string;
  checked_in_at: string;
  checked_out_at: string | null;
  profile_id: string;
  full_name: string | null;
  email: string | null;
};

export async function getTodayAttendance(gymId: string): Promise<TodayRow[]> {
  const supabase = await createClient();
  const today = gymTodayKey();

  const { data } = await supabase
    .from("attendance")
    .select("id, checked_in_at, checked_out_at, profile_id, profiles(full_name, email)")
    .eq("gym_id", gymId)
    .gte("checked_in_at", `${today}T00:00:00+05:30`)
    .lte("checked_in_at", `${today}T23:59:59+05:30`)
    .order("checked_in_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    checked_in_at: row.checked_in_at,
    checked_out_at: row.checked_out_at,
    profile_id: row.profile_id,
    full_name: row.profiles?.full_name ?? null,
    email: row.profiles?.email ?? null,
  }));
}

export async function getPlans(gymId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("plans")
    .select("id, name, price_paise, duration_days, is_active, benefits, created_at")
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

export async function getStaff(gymId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("staff")
    .select("id, role, user_id, created_at")
    .eq("gym_id", gymId)
    .order("created_at", { ascending: true });

  if (!data || data.length === 0) return [];

  // staff has no email column; the address lives on the profile.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("id", data.map((s) => s.user_id));

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  return data.map((s) => ({
    id: s.id,
    role: s.role,
    email: byId.get(s.user_id)?.email ?? null,
    full_name: byId.get(s.user_id)?.full_name ?? null,
  }));
}

export type PaymentRow = {
  id: string;
  paid_at: string;
  amount_paise: number;
  method: "cash" | "upi" | "card" | "other";
  status: "collected" | "pending" | "refunded";
  full_name: string | null;
  plan_name: string | null;
};

export async function getPayments(gymId: string, limit = 60): Promise<PaymentRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("payments")
    .select("id, paid_at, amount_paise, method, status, profiles(full_name), plans(name)")
    .eq("gym_id", gymId)
    .order("paid_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((p) => ({
    id: p.id,
    paid_at: p.paid_at,
    amount_paise: p.amount_paise,
    method: p.method,
    status: p.status,
    full_name: p.profiles?.full_name ?? null,
    plan_name: p.plans?.name ?? null,
  }));
}

export type MonthlyRevenue = { monthKey: string; label: string; collectedPaise: number };

export type RevenueSummary = {
  lifetimePaise: number;
  thisMonthPaise: number;
  lastMonthPaise: number;
  outstandingPaise: number;
  outstandingMembers: number;
  months: MonthlyRevenue[];
};

/**
 * Revenue rolled up in JS rather than SQL.
 *
 * The whole payment history for one small gym is a few hundred rows, so
 * pulling it once and bucketing here is cheaper than six round trips and
 * keeps the month boundaries in the gym's timezone, which `date_trunc` on the
 * server would not do without more ceremony than it is worth.
 */
export async function getRevenueSummary(gymId: string): Promise<RevenueSummary> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("payments")
    .select("amount_paise, status, paid_at, profile_id")
    .eq("gym_id", gymId);

  const rows = data ?? [];
  const monthOf = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
    })
      .format(new Date(iso))
      .slice(0, 7);

  const now = new Date();
  const thisMonth = monthOf(now.toISOString());
  const lastMonthDate = new Date(now);
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonth = monthOf(lastMonthDate.toISOString());

  const byMonth = new Map<string, number>();
  let lifetimePaise = 0;
  let outstandingPaise = 0;
  const outstandingProfiles = new Set<string>();

  for (const row of rows) {
    if (row.status === "collected") {
      lifetimePaise += row.amount_paise;
      const key = monthOf(row.paid_at);
      byMonth.set(key, (byMonth.get(key) ?? 0) + row.amount_paise);
    } else if (row.status === "pending") {
      outstandingPaise += row.amount_paise;
      outstandingProfiles.add(row.profile_id);
    }
  }

  // Last six months including this one, oldest first, zero-filled.
  const months: MonthlyRevenue[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const key = monthOf(d.toISOString());
    months.push({
      monthKey: key,
      label: new Intl.DateTimeFormat("en-IN", { month: "short" }).format(d),
      collectedPaise: byMonth.get(key) ?? 0,
    });
  }

  return {
    lifetimePaise,
    thisMonthPaise: byMonth.get(thisMonth) ?? 0,
    lastMonthPaise: byMonth.get(lastMonth) ?? 0,
    outstandingPaise,
    outstandingMembers: outstandingProfiles.size,
    months,
  };
}

export type DashboardStats = {
  activeMembers: number;
  activeLastMonth: number;
  newThisMonth: number;
  newLastMonth: number;
  checkinsToday: number;
  inGymNow: number;
  recent: Array<{ id: string; full_name: string | null; created_at: string }>;
  registrationsThisWeek: number;
};

export async function getDashboardStats(gymId: string): Promise<DashboardStats> {
  const supabase = await createClient();

  const today = gymTodayKey();
  const monthStart = `${today.slice(0, 7)}-01`;
  const lastMonthStart = (() => {
    const d = new Date(`${monthStart}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - 1);
    return d.toISOString().slice(0, 10);
  })();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [active, newThis, newLast, todayCount, live, recent, week] = await Promise.all([
    supabase
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", gymId)
      .eq("status", "active")
      .gte("end_date", today),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", gymId)
      .gte("created_at", monthStart),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", gymId)
      .gte("created_at", lastMonthStart)
      .lt("created_at", monthStart),
    supabase
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", gymId)
      .gte("checked_in_at", `${today}T00:00:00+05:30`),
    supabase
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", gymId)
      .is("checked_out_at", null)
      .gte("checked_in_at", `${today}T00:00:00+05:30`),
    supabase
      .from("profiles")
      .select("id, full_name, created_at")
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", gymId)
      .gte("created_at", weekAgo),
  ]);

  return {
    activeMembers: active.count ?? 0,
    activeLastMonth: Math.max(0, (active.count ?? 0) - (newThis.count ?? 0)),
    newThisMonth: newThis.count ?? 0,
    newLastMonth: newLast.count ?? 0,
    checkinsToday: todayCount.count ?? 0,
    inGymNow: live.count ?? 0,
    recent: recent.data ?? [],
    registrationsThisWeek: week.count ?? 0,
  };
}
