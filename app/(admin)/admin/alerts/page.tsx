import { PageHeading } from "@/components/admin/PageHeading";
import { AlertsManager } from "@/components/admin/AlertsManager";
import { ErrorState } from "@/components/ui/ErrorState";
import { getAlerts, getStaffGym } from "@/lib/queries/admin";
import { strings } from "@/lib/strings";

export const metadata = { title: strings.admin.alerts.title };
export const dynamic = "force-dynamic";

export default async function AdminAlertsPage() {
  const gym = await getStaffGym();
  if (!gym) {
    return (
      <ErrorState
        title={strings.common.networkErrorTitle}
        body={strings.common.networkErrorBody}
      />
    );
  }

  const alerts = await getAlerts(gym.id);

  return (
    <>
      <PageHeading title={strings.admin.alerts.title} />
      <AlertsManager gymId={gym.id} alerts={alerts} />
    </>
  );
}
