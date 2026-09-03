import { MembersView, type MemberDetail } from "@/components/admin/MembersView";
import { ErrorState } from "@/components/ui/ErrorState";
import { getMemberDetail, getMembers, getStaffGym } from "@/lib/queries/admin";
import { getOfferedPlans } from "@/lib/queries/member";
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

  // Captured before the closure below, which loses the null narrowing.
  const gymId = gym.id;
  const members = await getMembers(gymId);

  /**
   * Detail is fetched per member on selection rather than for all of them up
   * front — 84 members × membership history × 30 days of attendance is a lot
   * of rows to ship for the one row someone actually clicks.
   */
  async function loadDetail(profileId: string): Promise<MemberDetail> {
    "use server";
    const [detail, plans] = await Promise.all([
      getMemberDetail(profileId),
      getOfferedPlans(gymId, profileId),
    ]);

    return {
      memberships: detail.memberships.map((m) => ({
        id: m.id,
        start_date: m.start_date,
        end_date: m.end_date,
        plan_name: m.plan_name,
        price_paise: m.price_paise,
      })),
      days: last30Days(detail.attendance),
      discount: detail.discount,
      /**
       * The list price travels alongside the payable one so the desk can see
       * when a member is being charged less than the sticker. Neither is the
       * amount charged — `record_cash_payment` recomputes that in the
       * database, so nothing sent from a browser can decide it.
       */
      plans: plans.map((p) => ({
        id: p.id,
        name: p.name,
        price_paise: p.price_paise,
        duration_days: p.duration_days,
        payable_paise: p.payable_paise,
      })),
    };
  }

  return <MembersView gymId={gymId} members={members} loadDetail={loadDetail} />;
}
