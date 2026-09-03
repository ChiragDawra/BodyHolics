import Link from "next/link";
import { redirect } from "next/navigation";
import { MemberHeader } from "@/components/member/MemberHeader";
import { MemberTabBar } from "@/components/member/MemberTabBar";
import { PayDuesButton } from "@/components/member/PayDuesButton";
import { Card, CardLabel } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { TagIcon, AddSquareIcon } from "@/components/ui/icons";
import { getMemberSnapshot } from "@/lib/queries/member";
import { formatFullDate, formatDay, membershipSpan } from "@/lib/format";
import { MembershipTimeline } from "@/components/member/MembershipTimeline";
import { PaymentHistoryRow } from "@/components/member/PaymentHistoryRow";
import { CheckList } from "@/components/ui/CheckList";
import { formatPhone } from "@/lib/gym";
import { strings } from "@/lib/strings";

export const metadata = { title: strings.member.meTitle };
export const dynamic = "force-dynamic";

export default async function MemberMePage() {
  const snapshot = await getMemberSnapshot();
  if (!snapshot) redirect("/join");
  if (!snapshot.profile.phone) redirect("/app/complete-profile");

  const { profile, membership, duesPaise, payments } = snapshot;
  const span = membership
    ? membershipSpan(membership.start_date, membership.end_date)
    : null;
  const active = membership !== null && membership.status === "active";

  const initial = (profile.full_name ?? profile.email ?? "?")
    .charAt(0)
    .toUpperCase();

  return (
    <>
      <MemberHeader title={strings.member.meTitle} />

      <div className="flex flex-col gap-2.5 px-4 pb-32">
        <div className="flex items-center gap-3.5 px-1 pb-4 pt-1.5">
          <span
            aria-hidden
            className="flex h-13 w-13 flex-none items-center justify-center rounded-full border border-border bg-surface-overlay font-display text-xl font-bold text-ink-muted"
          >
            {initial}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-xl font-bold tracking-tight text-ink">
              {profile.full_name ?? ""}
            </p>
            <p className="truncate text-sm text-ink-dim">
              {[profile.email, formatPhone(profile.phone)]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>

        <Card className="bh-panel px-4.5 py-5">
          {membership ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="font-display text-lg font-bold tracking-tight text-ink">
                  {membership.plan_name ?? ""}
                </span>
                <Badge tone={active ? "success" : "danger"}>
                  {active
                    ? strings.member.membershipActive
                    : membership.status === "cancelled"
                      ? strings.member.membershipCancelled
                      : strings.member.membershipExpired}
                </Badge>
              </div>

              <div className="mt-4 flex items-baseline gap-2.5">
                <span className="font-display text-5xl leading-none font-bold tracking-tighter text-brand">
                  {span?.daysLeft ?? 0}
                </span>
                <span className="text-base text-ink-muted">
                  {strings.member.daysLeft}
                </span>
              </div>

              <div className="mt-5 mb-5">
                <MembershipTimeline
                  startDate={membership.start_date}
                  endDate={membership.end_date}
                />
              </div>

              <dl>
                {membership.plan_price_paise !== null ? (
                  <Row
                    label={strings.member.price}
                    value={strings.common.rupees(membership.plan_price_paise)}
                  />
                ) : null}
                <Row
                  label={strings.member.started}
                  value={formatFullDate(membership.start_date)}
                />
                <Row
                  label={strings.member.ends}
                  value={formatFullDate(membership.end_date)}
                />
              </dl>
            </>
          ) : (
            <EmptyState
              icon={<TagIcon className="h-6 w-6" />}
              title={strings.member.noMembership}
              body={strings.member.noMembershipBody}
            />
          )}
        </Card>

        {/* Only renders when the gym has actually described the plan. */}
        {membership && membership.plan_benefits.length > 0 ? (
          <Card className="p-4.5">
            <CardLabel>{strings.member.planBenefits}</CardLabel>
            <div className="mt-3.5">
              <CheckList items={membership.plan_benefits} />
            </div>
          </Card>
        ) : null}

        {/* Payments are explicitly out of scope for this build. The control is
            shown but visibly off, so the owner can see where it will live. */}
        <Card className="p-4.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <CardLabel>{strings.member.payment}</CardLabel>
              <p className="mt-1.5 text-sm font-medium text-ink-muted">
                {duesPaise > 0
                  ? strings.member.duesOwed(strings.common.rupees(duesPaise))
                  : strings.member.nothingDue}
              </p>
            </div>
            <PayDuesButton />
          </div>
          <p className="mt-3 text-xs text-ink-faint">{strings.member.comingSoon}</p>
        </Card>

        <Card className="px-4.5 pb-1.5 pt-4.5">
          <CardLabel>{strings.member.paymentHistory}</CardLabel>
          {payments.length === 0 ? (
            <p className="py-4 text-sm text-ink-dim">
              {strings.member.paymentHistoryEmptyBody}
            </p>
          ) : (
            <ul className="mt-1.5">
              {payments.map((payment) => (
                <PaymentHistoryRow key={payment.id} payment={payment} />
              ))}
            </ul>
          )}
        </Card>

        <Link href="/install" className="block">
          <Button variant="secondary" fullWidth size="lg">
            <AddSquareIcon className="h-4.5 w-4.5" />
            {strings.join.addToHome}
          </Button>
        </Link>

        <div className="flex items-center justify-between gap-3 px-1.5 pt-4">
          <span className="text-xs text-ink-dim">
            {strings.member.memberSince(formatDay(profile.created_at))}
          </span>
          <SignOutButton label={strings.member.signOut} variant="link" />
        </div>
      </div>

      <MemberTabBar />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border-soft py-2.5">
      <dt className="text-sm text-ink-dim">{label}</dt>
      <dd className="text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}
