"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { strings } from "@/lib/strings";

export type ProfileResult =
  | { ok: true; staffGranted: boolean }
  | { ok: false; message: string };

const schema = z.object({
  fullName: z.string().trim().min(1).max(80),
  // Stored as digits; the UI shows the +91 prefix separately.
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length >= 10, { message: "phone" }),
  emergencyContact: z.string().trim().max(120).optional().default(""),
  staffCode: z.string().trim().max(40).optional().default(""),
});

/**
 * Finishes the join form.
 *
 * The staff code is handled by a SECURITY DEFINER function rather than here,
 * because a member must be able to *use* a code without being able to read
 * the staff_codes table. This action never sees whether a code exists — only
 * whether the database granted staff.
 */
export async function completeProfile(input: unknown): Promise<ProfileResult> {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    const isPhone = parsed.error.issues.some((i) => i.message === "phone");
    return {
      ok: false,
      message: isPhone ? strings.join.phoneRequired : strings.common.unexpectedBody,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_profile", {
    p_full_name: parsed.data.fullName,
    p_phone: parsed.data.phone,
    p_emergency_contact: parsed.data.emergencyContact,
    p_staff_code: parsed.data.staffCode,
  });

  if (error) {
    return {
      ok: false,
      message:
        error.message === "phone_required"
          ? strings.join.phoneRequired
          : strings.common.networkErrorBody,
    };
  }

  const result = data as { staff_granted?: boolean } | null;

  revalidatePath("/app");
  revalidatePath("/admin");

  return { ok: true, staffGranted: result?.staff_granted === true };
}

/** Lights up the green "Staff" chip as the code is typed. Never reveals a code. */
export async function checkStaffCode(code: unknown): Promise<boolean> {
  const parsed = z.string().trim().max(40).safeParse(code);
  if (!parsed.success || parsed.data === "") return false;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_code_valid", {
    p_code: parsed.data,
  });

  if (error) return false;
  return data === true;
}

/** Marks alerts read. Called when the member opens the alerts sheet. */
export async function markAlertsRead(alertIds: unknown): Promise<void> {
  const parsed = z.array(z.string().uuid()).max(50).safeParse(alertIds);
  if (!parsed.success || parsed.data.length === 0) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("alert_reads").upsert(
    parsed.data.map((alert_id) => ({ alert_id, profile_id: user.id })),
    { onConflict: "alert_id,profile_id" },
  );
}
