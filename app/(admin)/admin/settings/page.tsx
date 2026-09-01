import { PageHeading } from "@/components/admin/PageHeading";
import { GymSettings } from "@/components/admin/GymSettings";
import { ErrorState } from "@/components/ui/ErrorState";
import { createClient } from "@/lib/supabase/server";
import { getPlans, getStaff, getStaffGym } from "@/lib/queries/admin";
import { parseWeeklyHours, resolveOpenState } from "@/lib/gym";
import { strings } from "@/lib/strings";

export const metadata = { title: strings.admin.settings.title };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const gym = await getStaffGym();
  if (!gym) {
    return (
      <ErrorState
        title={strings.common.networkErrorTitle}
        body={strings.common.networkErrorBody}
      />
    );
  }

  const supabase = await createClient();
  const [plans, staff, codeResult] = await Promise.all([
    getPlans(gym.id),
    getStaff(gym.id),
    // Readable here only because RLS lets staff read their own gym's codes.
    supabase
      .from("staff_codes")
      .select("code")
      .eq("gym_id", gym.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <>
      <PageHeading
        title={strings.admin.settings.title}
        subtitle={strings.admin.settings.lede}
      />
      <GymSettings
        gymId={gym.id}
        joinCode={gym.join_code}
        openState={resolveOpenState(
          parseWeeklyHours(gym.weekly_hours),
          gym.is_open_override,
        )}
        crowdLevel={gym.crowd_level}
        initialHours={parseWeeklyHours(gym.weekly_hours)}
        plans={plans}
        staff={staff}
        staffCode={codeResult.data?.code ?? null}
      />
    </>
  );
}
