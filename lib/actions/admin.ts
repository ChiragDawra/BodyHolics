"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { CROWD_LEVELS } from "@/lib/gym";
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

/**
 * Postgres reports an UPDATE that RLS filtered down to nothing as a *success*
 * that touched zero rows, so `error` is null and the caller believes it wrote.
 * That is exactly how the gym open/closed and crowd toggles appeared to work
 * for weeks while never changing the row (see Phase 8 in DECISIONS.md).
 *
 * Every gym write therefore asks for the updated rows back and treats an
 * empty result as the failure it is.
 */
const NOT_WRITTEN: ActionResult = {
  ok: false,
  message: strings.admin.writeRejectedBody,
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
  /**
   * Typed one per line in the settings form. Blank lines are dropped, so an
   * empty box means an empty array and the member's benefits checklist
   * renders nothing rather than an empty heading.
   */
  benefits: z
    .string()
    .default("")
    .transform((v) =>
      v
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .slice(0, 12),
    ),
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
    benefits: parsed.data.benefits,
  });

  if (error) return FAILED;

  revalidatePath("/admin/settings");
  revalidatePath("/app/me");
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
      benefits: parsed.data.benefits,
    })
    .eq("id", parsed.data.planId);

  if (error) return FAILED;

  revalidatePath("/admin/settings");
  revalidatePath("/app/me");
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

  revalidatePath("/admin/settings");
  revalidatePath("/app/me");
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

/**
 * A time as the browser's <input type="time"> gives it: "05:30". Postgres
 * hands the same column back as "05:30:00", which the tolerant tail makes
 * legal here so a round trip through the form does not fail validation.
 */
const timeSchema = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/);

const scheduleRowSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(1).max(7),
  startTime: timeSchema,
  endTime: timeSchema,
});

/** Rejects a block that ends before it starts, matching the CHECK constraint. */
function ordered(row: { startTime: string; endTime: string }): boolean {
  return row.endTime.slice(0, 5) > row.startTime.slice(0, 5);
}

/**
 * Opening hours, replaced wholesale.
 *
 * Delete-then-insert rather than diffing: the whole schedule is at most a few
 * dozen rows, the editor hands back the complete list every time, and a diff
 * would be more code with more ways to leave an orphan behind.
 */
export async function replaceHourBlocks(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({
      gymId: z.string().uuid(),
      blocks: z.array(scheduleRowSchema).max(60),
    })
    .safeParse(input);

  if (!parsed.success) return FAILED;
  if (parsed.data.blocks.some((b) => !ordered(b))) {
    return { ok: false, message: strings.admin.settings.blockOutOfOrder };
  }
  if (!(await guard())) return DENIED;

  const supabase = await createClient();

  const { error: clearError } = await supabase
    .from("gym_hour_blocks")
    .delete()
    .eq("gym_id", parsed.data.gymId);
  if (clearError) return FAILED;

  if (parsed.data.blocks.length > 0) {
    const { error } = await supabase.from("gym_hour_blocks").insert(
      parsed.data.blocks.map((b) => ({
        gym_id: parsed.data.gymId,
        day_of_week: b.dayOfWeek,
        start_time: b.startTime,
        end_time: b.endTime,
      })),
    );
    if (error) return FAILED;
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  revalidatePath("/app");
  revalidatePath("/");
  return { ok: true };
}

/** The weekly crowd timetable, replaced wholesale for the same reasons. */
export async function replaceCrowdSchedule(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({
      gymId: z.string().uuid(),
      slots: z
        .array(scheduleRowSchema.extend({ level: z.enum(CROWD_LEVELS) }))
        .max(120),
    })
    .safeParse(input);

  if (!parsed.success) return FAILED;
  if (parsed.data.slots.some((s) => !ordered(s))) {
    return { ok: false, message: strings.admin.settings.blockOutOfOrder };
  }
  if (!(await guard())) return DENIED;

  const supabase = await createClient();

  const { error: clearError } = await supabase
    .from("crowd_schedule")
    .delete()
    .eq("gym_id", parsed.data.gymId);
  if (clearError) return FAILED;

  if (parsed.data.slots.length > 0) {
    const { error } = await supabase.from("crowd_schedule").insert(
      parsed.data.slots.map((s) => ({
        gym_id: parsed.data.gymId,
        day_of_week: s.dayOfWeek,
        start_time: s.startTime,
        end_time: s.endTime,
        level: s.level,
      })),
    );
    if (error) return FAILED;
  }

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
  const { data, error } = await supabase
    .from("gyms")
    .update({ is_open_override: parsed.data.isOpen })
    .eq("id", parsed.data.gymId)
    .select("id");

  if (error) return FAILED;
  if (!data || data.length === 0) return NOT_WRITTEN;

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  revalidatePath("/app");
  revalidatePath("/");
  return { ok: true };
}

/**
 * The manual crowd level. Null hands control back to the weekly timetable,
 * the same shape as clearing the open/closed override.
 */
export async function setCrowdOverride(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({
      gymId: z.string().uuid(),
      level: z.enum(CROWD_LEVELS).nullable(),
    })
    .safeParse(input);
  if (!parsed.success) return FAILED;
  if (!(await guard())) return DENIED;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gyms")
    .update({
      crowd_override: parsed.data.level,
      crowd_updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.gymId)
    .select("id");

  if (error) return FAILED;
  if (!data || data.length === 0) return NOT_WRITTEN;

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  revalidatePath("/app");
  revalidatePath("/");
  return { ok: true };
}

/* ---------------------------------------------------------------- payments */

/**
 * Cash at the desk: the payment and the membership it buys, together.
 *
 * The price is not passed in. `record_cash_payment` reads it from the plan
 * and applies the member's discount itself, so nothing a browser sends can
 * decide what someone is charged.
 */
export async function recordCashPayment(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({
      profileId: z.string().uuid(),
      planId: z.string().uuid(),
    })
    .safeParse(input);

  if (!parsed.success) return FAILED;
  if (!(await guard())) return DENIED;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_cash_payment", {
    p_profile_id: parsed.data.profileId,
    p_plan_id: parsed.data.planId,
  });

  if (error || !data || data.length === 0) return FAILED;

  revalidatePath("/admin/members");
  revalidatePath("/admin/revenue");
  revalidatePath("/admin");
  revalidatePath("/app");
  revalidatePath("/app/me");
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
