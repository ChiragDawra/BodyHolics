import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/auth";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import {
  DAY_LABELS,
  parseWeeklyHours,
  resolveOpenState,
  formatTime,
  CROWD_BG,
} from "@/lib/gym";
import { strings } from "@/lib/strings";

// Opening hours and crowd change through the day, so this cannot be static.
export const revalidate = 0;

export default async function LandingPage() {
  const supabase = await createClient();
  const [{ data: gym }, user] = await Promise.all([
    supabase
      .from("gyms")
      .select("name, join_code, weekly_hours, is_open_override, crowd_level")
      .limit(1)
      .maybeSingle(),
    getUser(),
  ]);

  const hours = parseWeeklyHours(gym?.weekly_hours);
  const openState = resolveOpenState(hours, gym?.is_open_override ?? null);
  const crowd = gym?.crowd_level ?? "not_crowded";

  const weekday = hours.mon;
  const weekend = hours.sat;

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-16 pt-[calc(3rem+env(safe-area-inset-top))]">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={`h-2.5 w-2.5 rounded-full ${
              openState.isOpen ? "bg-success" : "bg-danger"
            }`}
          />
          <span
            className={`font-display text-sm font-semibold ${
              openState.isOpen ? "text-success" : "text-danger"
            }`}
          >
            {openState.isOpen
              ? strings.member.gymOpen
              : strings.member.gymClosed}
          </span>
        </div>

        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          {gym?.name ?? strings.landing.title}
        </h1>
        <p className="text-lg text-ink text-balance">{strings.landing.tagline}</p>
        <p className="text-ink-muted">{strings.landing.lede}</p>
      </div>

      <div className="mt-8 space-y-3">
        {user ? (
          <Link href="/app" className="block">
            <Button size="lg" fullWidth>
              {strings.landing.openMemberApp}
            </Button>
          </Link>
        ) : (
          <Link
            href={gym ? `/join?g=${gym.join_code}` : "/join"}
            className="block"
          >
            <Button size="lg" fullWidth>
              {strings.landing.joinCta}
            </Button>
          </Link>
        )}
      </div>

      <section className="mt-10 space-y-3">
        <h2 className="font-display text-lg font-semibold text-ink">
          {strings.member.crowdHeading}
        </h2>
        <Card>
          <CardBody className="flex items-center gap-3 pt-4">
            <span
              aria-hidden
              className={`h-3 w-3 shrink-0 rounded-full ${CROWD_BG[crowd]}`}
            />
            <div>
              <p className="font-display font-semibold text-ink">
                {strings.member.crowd[crowd]}
              </p>
              <p className="text-sm text-ink-muted">
                {strings.member.crowdCaption[crowd]}
              </p>
            </div>
          </CardBody>
        </Card>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="font-display text-lg font-semibold text-ink">
          {strings.landing.hoursHeading}
        </h2>
        <Card>
          <CardBody className="divide-y divide-border pt-0">
            <HoursRow
              label={strings.landing.weekdays}
              hours={weekday ? `${formatTime(weekday.open)} to ${formatTime(weekday.close)}` : strings.landing.closed}
            />
            <HoursRow
              label={strings.landing.weekends}
              hours={weekend ? `${formatTime(weekend.open)} to ${formatTime(weekend.close)}` : strings.landing.closed}
            />
          </CardBody>
        </Card>
        {openState.overridden ? (
          <Badge tone={openState.isOpen ? "success" : "danger"}>
            {openState.isOpen
              ? strings.member.gymOpen
              : strings.member.gymClosed}
          </Badge>
        ) : null}
        <p className="sr-only">
          {Object.entries(DAY_LABELS)
            .map(([key, label]) => {
              const day = hours[key as keyof typeof hours];
              return `${label}: ${day ? `${formatTime(day.open)} to ${formatTime(day.close)}` : strings.landing.closed}`;
            })
            .join(". ")}
        </p>
      </section>
    </main>
  );
}

function HoursRow({ label, hours }: { label: string; hours: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-ink">{label}</span>
      <span className="font-display font-semibold text-ink">{hours}</span>
    </div>
  );
}
