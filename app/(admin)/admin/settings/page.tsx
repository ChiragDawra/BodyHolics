import { PageHeading } from "@/components/admin/PageHeading";
import { GymSettingsForm } from "@/components/admin/GymSettingsForm";
import { ErrorState } from "@/components/ui/ErrorState";
import { getStaffGym } from "@/lib/queries/admin";
import { parseWeeklyHours } from "@/lib/gym";
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

  return (
    <>
      <PageHeading title={strings.admin.settings.title} subtitle={gym.name} />
      <GymSettingsForm
        gymId={gym.id}
        joinCode={gym.join_code}
        initialHours={parseWeeklyHours(gym.weekly_hours)}
        initialOverride={gym.is_open_override}
        initialCrowd={gym.crowd_level}
      />
    </>
  );
}
