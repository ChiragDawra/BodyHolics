import { MembersView, type MemberDetail } from "@/components/admin/MembersView";
import { ErrorState } from "@/components/ui/ErrorState";
import { getMemberDetail, getMembers, getStaffGym } from "@/lib/queries/admin";
import { last30Days } from "@/lib/attendance";
import { strings } from "@/lib/strings";

export const metadata = { title: strings.admin.members.title };
export const dynamic = "force-dynamic";

export default async function AdminMembersPage() {
  const gym = await getStaffGym();
  if (!gym) {
    return (
      <ErrorState
        title={strings.common.networkErrorTitle}
        body={strings.common.networkErrorBody}
      />
    );
  }

  const members = await getMembers(gym.id);

  /**
   * Detail is fetched per member on selection rather than for all of them up
   * front — 84 members × membership history × 30 days of attendance is a lot
   * of rows to ship for the one row someone actually clicks.
   */
  async function loadDetail(profileId: string): Promise<MemberDetail> {
    "use server";
    const detail = await getMemberDetail(profileId);
    return {
      memberships: detail.memberships.map((m) => ({
        id: m.id,
        start_date: m.start_date,
        end_date: m.end_date,
        plan_name: m.plan_name,
        price_paise: m.price_paise,
      })),
      days: last30Days(detail.attendance),
    };
  }

  return <MembersView gymId={gym.id} members={members} loadDetail={loadDetail} />;
}
