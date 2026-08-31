import { z } from "zod";

/**
 * The check_dashboard RPC returns jsonb, which arrives as `unknown`. Parsing
 * it here means a schema change shows up as a caught validation error rather
 * than an undefined read somewhere deep in a component.
 */
export const crowdLevelSchema = z.enum([
  "not_crowded",
  "moderate",
  "crowded",
  "very_crowded",
]);

export const checkDashboardSchema = z.object({
  gym_id: z.string(),
  gym_name: z.string(),
  crowd_level: crowdLevelSchema,
  is_open_override: z.boolean().nullable(),
  weekly_hours: z.unknown(),
  today_count: z.coerce.number(),
  active_members: z.coerce.number(),
  recent: z.array(
    z.object({
      full_name: z.string().nullable(),
      checked_in_at: z.string(),
    }),
  ),
  latest_alert: z
    .object({ title: z.string(), created_at: z.string() })
    .nullable(),
});

export type CheckDashboardData = z.infer<typeof checkDashboardSchema>;

export const alertDraftSchema = z.object({
  title: z.string().trim().min(1),
  body: z.string().trim().default(""),
});
