import { PageHeading } from "@/components/admin/PageHeading";
import { AlertsManager } from "@/components/admin/AlertsManager";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  getAlerts,
  getMemberCount,
  getStaffGym,
  getWhatsAppMessages,
} from "@/lib/queries/admin";
import { WhatsAppLog } from "@/components/admin/WhatsAppLog";
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

  const [alerts, memberCount, messages] = await Promise.all([
    getAlerts(gym.id),
    getMemberCount(gym.id),
    getWhatsAppMessages(gym.id),
  ]);

  return (
    <>
      <PageHeading title={strings.admin.alerts.title} subtitle={strings.admin.alerts.lede} />
      <AlertsManager gymId={gym.id} alerts={alerts} memberCount={memberCount} />

      <div className="mt-3.5">
        <WhatsAppLog messages={messages} />
      </div>
    </>
  );
}
