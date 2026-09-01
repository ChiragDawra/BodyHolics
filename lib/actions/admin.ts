"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isStaff } from "@/lib/supabase/auth";
import { strings } from "@/lib/strings";

/**
 * Every admin write goes through here.
 *
 * Each action re-checks staff membership before touching anything. RLS would
 * reject a non-staff write anyway — this is the second of three layers, and it
 * turns a silent empty result into a clear message.
 */

export type ActionResult = { ok: true } | { ok: false; message: string };

const FAILED: ActionResult = {
  ok: false,
  message: strings.common.networkErrorBody,
};

const DENIED: ActionResult = {
  ok: false,
  message: strings.admin.notStaffBody,
};

async function guard() {
  return await isStaff();
}

/* ----------------------------------------------------------------- check-in */

const checkInSchema = z.object({
  gymId: z.string().uuid(),
  profileId: z.string().uuid(),
});

export async function checkInMember(input: unknown): Promise<ActionResult> {
  const parsed = checkInSchema.safeParse(input);
  if (!parsed.success) return FAILED;
  if (!(await guard())) return DENIED;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("attendance").insert({
    gym_id: parsed.data.gymId,
    profile_id: parsed.data.profileId,
    method: "manual",
    recorded_by: user?.id ?? null,
  });

  if (error) return FAILED;

  revalidatePath("/admin/attendance");
  revalidatePath("/admin/members");
  return { ok: true };
}

/** Marks someone as having left. Drives the "in the gym now" count down. */
export async function checkOutMember(attendanceId: unknown): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(attendanceId);
  if (!parsed.success) return FAILED;
  if (!(await guard())) return DENIED;

  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance")
    .update({ checked_out_at: new Date().toISOString() })
    .eq("id", parsed.data)
    .is("checked_out_at", null);

  if (error) return FAILED;

  revalidatePath("/admin/attendance");
  revalidatePath("/admin");
  revalidatePath("/app");
  return { ok: true };
}

/**
 * Adds someone who joined at the desk and has no phone to scan the code with.
 *
 * These profiles have no auth.users row, so they cannot sign in — they exist
 * as records the desk can check in and bill. If they later sign in with
 * Google, that creates a separate profile; merging the two is a real feature
 * and deliberately not attempted here.
 */
export async function addMemberManually(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({
      gymId: z.string().uuid(),
      fullName: z.string().trim().min(1).max(80),
      phone: z.string().transform((v) => v.replace(/\D/g, "")),
      email: z.string().trim().email().optional().or(z.literal("")),
    })
    .safeParse(input);

  if (!parsed.success) return FAILED;
  if (!(await guard())) return DENIED;

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_walk_in_member", {
    p_gym_id: parsed.data.gymId,
    p_full_name: parsed.data.fullName,
    p_phone: parsed.data.phone,
    // The SQL collapses "" to null via nullif, so there is no null to pass.
    p_email: parsed.data.email ?? "",
  });

  if (error) return FAILED;

  revalidatePath("/admin/members");
  return { ok: true };
}

export async function undoCheckIn(attendanceId: unknown): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(attendanceId);
  if (!parsed.success) return FAILED;
  if (!(await guard())) return DENIED;

  const supabase = await createClient();
  const { error } = await supabase.from("attendance").delete().eq("id", parsed.data);
  if (error) return FAILED;

  revalidatePath("/admin/attendance");
  return { ok: true };
}

/* -------------------------------------------------------------------- plans */

const planSchema = z.object({
  gymId: z.string().uuid(),
  name: z.string().trim().min(1).max(60),
  // Entered in whole rupees, stored as paise.
  priceRupees: z.coerce.number().int().min(0).max(1_000_000),
  durationDays: z.coerce.number().int().min(1).max(3650),
});

export async function createPlan(input: unknown): Promise<ActionResult> {
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return FAILED;
  if (!(await guard())) return DENIED;

  const supabase = await createClient();
  const { error } = await supabase.from("plans").insert({
    gym_id: parsed.data.gymId,
    name: parsed.data.name,
    price_paise: parsed.data.priceRupees * 100,
    duration_days: parsed.data.durationDays,
  });

  if (error) return FAILED;

  revalidatePath("/admin/plans");
  return { ok: true };
}

export async function updatePlan(input: unknown): Promise<ActionResult> {
  const parsed = planSchema.extend({ planId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return FAILED;
  if (!(await guard())) return DENIED;

  const supabase = await createClient();
  const { error } = await supabase
    .from("plans")
    .update({
      name: parsed.data.name,
      price_paise: parsed.data.priceRupees * 100,
      duration_days: parsed.data.durationDays,
    })
    .eq("id", parsed.data.planId);

  if (error) return FAILED;

  revalidatePath("/admin/plans");
  return { ok: true };
}

export async function togglePlan(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({ planId: z.string().uuid(), isActive: z.boolean() })
    .safeParse(input);
  if (!parsed.success) return FAILED;
  if (!(await guard())) return DENIED;

  const supabase = await createClient();
  const { error } = await supabase
    .from("plans")
    .update({ is_active: parsed.data.isActive })
    .eq("id", parsed.data.planId);

  if (error) return FAILED;

  revalidatePath("/admin/plans");
  return { ok: true };
}

/* -------------------------------------------------------------- memberships */

const membershipSchema = z.object({
  gymId: z.string().uuid(),
  profileId: z.string().uuid(),
  planId: z.string().uuid(),
});

/**
 * Starts a membership. The end date comes from the plan's duration rather than
 * being entered by hand, so the two can never disagree.
 */
export async function startMembership(input: unknown): Promise<ActionResult> {
  const parsed = membershipSchema.safeParse(input);
  if (!parsed.success) return FAILED;
  if (!(await guard())) return DENIED;

  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("plans")
    .select("duration_days")
    .eq("id", parsed.data.planId)
    .maybeSingle();

  if (!plan) return FAILED;

  const start = new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + plan.duration_days);

  const { error } = await supabase.from("memberships").insert({
    gym_id: parsed.data.gymId,
    profile_id: parsed.data.profileId,
    plan_id: parsed.data.planId,
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
    status: "active",
  });

  if (error) return FAILED;

  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${parsed.data.profileId}`);
  return { ok: true };
}

/* ------------------------------------------------------------- gym settings */

const dayHoursSchema = z
  .object({
    open: z.string().regex(/^\d{2}:\d{2}$/),
    close: z.string().regex(/^\d{2}:\d{2}$/),
  })
  .nullable();

const settingsSchema = z.object({
  gymId: z.string().uuid(),
  weeklyHours: z.object({
    mon: dayHoursSchema,
    tue: dayHoursSchema,
    wed: dayHoursSchema,
    thu: dayHoursSchema,
    fri: dayHoursSchema,
    sat: dayHoursSchema,
    sun: dayHoursSchema,
  }),
});

export async function updateHours(input: unknown): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return FAILED;
  if (!(await guard())) return DENIED;

  const supabase = await createClient();
  const { error } = await supabase
    .from("gyms")
    .update({ weekly_hours: parsed.data.weeklyHours })
    .eq("id", parsed.data.gymId);

  if (error) return FAILED;

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  revalidatePath("/app");
  revalidatePath("/");
  return { ok: true };
}

export async function setOpenOverride(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({ gymId: z.string().uuid(), isOpen: z.boolean().nullable() })
    .safeParse(input);
  if (!parsed.success) return FAILED;
  if (!(await guard())) return DENIED;

  const supabase = await createClient();
  const { error } = await supabase
    .from("gyms")
    .update({ is_open_override: parsed.data.isOpen })
    .eq("id", parsed.data.gymId);

  if (error) return FAILED;

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  revalidatePath("/app");
  revalidatePath("/");
  return { ok: true };
}

export async function setCrowdLevel(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({
      gymId: z.string().uuid(),
      level: z.enum(["not_crowded", "moderate", "crowded", "very_crowded"]),
    })
    .safeParse(input);
  if (!parsed.success) return FAILED;
  if (!(await guard())) return DENIED;

  const supabase = await createClient();
  const { error } = await supabase
    .from("gyms")
    .update({ crowd_level: parsed.data.level, crowd_updated_at: new Date().toISOString() })
    .eq("id", parsed.data.gymId);

  if (error) return FAILED;

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  revalidatePath("/app");
  revalidatePath("/");
  return { ok: true };
}

/* ------------------------------------------------------------------- alerts */

export async function publishAlert(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({
      gymId: z.string().uuid(),
      title: z.string().trim().min(1).max(120),
      body: z.string().trim().max(500).default(""),
    })
    .safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: strings.admin.alerts.needsTitle };
  }
  if (!(await guard())) return DENIED;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("alerts").insert({
    gym_id: parsed.data.gymId,
    title: parsed.data.title,
    body: parsed.data.body,
    created_by: user?.id ?? null,
  });

  if (error) return FAILED;

  revalidatePath("/admin/alerts");
  revalidatePath("/app");
  return { ok: true };
}

export async function deleteAlert(alertId: unknown): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(alertId);
  if (!parsed.success) return FAILED;
  if (!(await guard())) return DENIED;

  const supabase = await createClient();
  const { error } = await supabase.from("alerts").delete().eq("id", parsed.data);
  if (error) return FAILED;

  revalidatePath("/admin/alerts");
  return { ok: true };
}
