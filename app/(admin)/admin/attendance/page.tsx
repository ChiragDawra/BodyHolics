import { PageHeading } from "@/components/admin/PageHeading";
import { CheckInPanel } from "@/components/admin/CheckInPanel";
import { ErrorState } from "@/components/ui/ErrorState";
import { getMembers, getStaffGym, getTodayAttendance } from "@/lib/queries/admin";
import { strings } from "@/lib/strings";

export const metadata = { title: strings.admin.attendance.title };
export const dynamic = "force-dynamic";

export default async function AdminAttendancePage() {
  const gym = await getStaffGym();
  if (!gym) {
    return (
      <ErrorState
        title={strings.common.networkErrorTitle}
        body={strings.common.networkErrorBody}
      />
    );
  }

  const [members, today] = await Promise.all([
    getMembers(gym.id),
    getTodayAttendance(gym.id),
  ]);

  return (
    <>
      <PageHeading title={strings.admin.attendance.title} />
      <CheckInPanel gymId={gym.id} members={members} today={today} />
    </>
  );
}
