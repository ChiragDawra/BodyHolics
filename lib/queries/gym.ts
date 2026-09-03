import { createClient } from "@/lib/supabase/server";
import type { CrowdLevel, CrowdSlot, HourBlock } from "@/lib/gym";

/**
 * The gym's weekly schedule: when it is open, and how busy it usually is.
 *
 * Both tables are world-readable — the landing page shows opening hours and
 * crowd before anyone signs in — so this one function serves the public page,
 * the member app, and the admin dashboard.
 */

export type HourBlockRow = HourBlock & { id: string };
export type CrowdSlotRow = CrowdSlot & { id: string };

export type GymSchedule = {
  hourBlocks: HourBlockRow[];
  crowdSlots: CrowdSlotRow[];
};

export async function getGymSchedule(gymId: string): Promise<GymSchedule> {
  const supabase = await createClient();

  const [blocks, slots] = await Promise.all([
    supabase
      .from("gym_hour_blocks")
      .select("id, day_of_week, start_time, end_time")
      .eq("gym_id", gymId)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true }),
    supabase
      .from("crowd_schedule")
      .select("id, day_of_week, start_time, end_time, level")
      .eq("gym_id", gymId)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true }),
  ]);

  return {
    hourBlocks: blocks.data ?? [],
    crowdSlots: slots.data ?? [],
  };
}

/** The overrides that beat the schedule, plus the gym's identity. */
export type GymRow = {
  id: string;
  name: string;
  join_code: string;
  is_open_override: boolean | null;
  crowd_override: CrowdLevel | null;
};
