import { PageHeading } from "@/components/admin/PageHeading";
import { PlansManager } from "@/components/admin/PlansManager";
import { ErrorState } from "@/components/ui/ErrorState";
import { getPlans, getStaffGym } from "@/lib/queries/admin";
import { strings } from "@/lib/strings";

export const metadata = { title: strings.admin.plans.title };
export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  const gym = await getStaffGym();
  if (!gym) {
    return (
      <ErrorState
        title={strings.common.networkErrorTitle}
        body={strings.common.networkErrorBody}
      />
    );
  }

  const plans = await getPlans(gym.id);

  return (
    <>
      <PageHeading title={strings.admin.plans.title} />
      <PlansManager gymId={gym.id} plans={plans} />
    </>
  );
}
