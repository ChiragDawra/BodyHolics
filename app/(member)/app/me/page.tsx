import Link from "next/link";
import { redirect } from "next/navigation";
import Image from "next/image";
import { MemberHeader } from "@/components/member/MemberHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { TagIcon, AddSquareIcon } from "@/components/ui/icons";
import { getMemberSnapshot } from "@/lib/queries/member";
import { formatFullDate, daysUntil } from "@/lib/format";
import { strings } from "@/lib/strings";

export const metadata = { title: strings.member.meTitle };
export const dynamic = "force-dynamic";

export default async function MemberMePage() {
  const snapshot = await getMemberSnapshot();
  if (!snapshot) redirect("/join");

  const { profile, membership } = snapshot;
  const active =
    membership !== null &&
    membership.status === "active" &&
    daysUntil(membership.end_date) >= 0;

  return (
    <>
      <MemberHeader title={strings.member.meTitle} />

      <div className="space-y-4 px-4 pb-6">
        <Card>
          <CardBody className="flex items-center gap-4 pt-4">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt=""
                width={56}
                height={56}
                className="h-14 w-14 rounded-full object-cover"
                unoptimized
              />
            ) : (
              <div
                aria-hidden
                className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-subtle font-display text-xl font-bold text-brand"
              >
                {(profile.full_name ?? "?").charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-semibold text-ink">
                {profile.full_name ?? ""}
              </p>
              <p className="truncate text-sm text-ink-muted">
                {profile.email ?? ""}
              </p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={strings.member.membershipDetailsHeading} />
          <CardBody>
            {membership ? (
              <dl className="divide-y divide-border">
                <Row label={strings.member.plan} value={membership.plan_name ?? ""} />
                <Row
                  label={strings.member.started}
                  value={formatFullDate(membership.start_date)}
                />
                <Row
                  label={strings.member.ends}
                  value={formatFullDate(membership.end_date)}
                />
                <div className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-ink-muted">{strings.member.status}</dt>
                  <dd>
                    <Badge tone={active ? "success" : "danger"}>
                      {active
                        ? strings.member.membershipActive
                        : membership.status === "cancelled"
                          ? strings.member.membershipCancelled
                          : strings.member.membershipExpired}
                    </Badge>
                  </dd>
                </div>
              </dl>
            ) : (
              <EmptyState
                icon={<TagIcon className="h-6 w-6" />}
                title={strings.member.noMembership}
                body={strings.member.noMembershipBody}
              />
            )}
          </CardBody>
        </Card>

        <Link href="/install" className="block">
          <Button variant="secondary" fullWidth>
            <AddSquareIcon className="h-5 w-5" />
            {strings.member.installApp}
          </Button>
        </Link>

        <SignOutButton label={strings.member.signOut} />
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-display font-semibold text-ink">{value}</dd>
    </div>
  );
}
