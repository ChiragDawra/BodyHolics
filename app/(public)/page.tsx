import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/auth";
import { Button } from "@/components/ui/Button";
import { Card, CardLabel } from "@/components/ui/Card";
import {
  GymLiveProvider,
  LiveCrowdMeter,
  LiveHeroStatus,
} from "@/components/member/GymLive";
import { DAY_LABELS, parseWeeklyHours, formatTime } from "@/lib/gym";
import { homeFor } from "@/lib/config";
import { strings } from "@/lib/strings";

// Opening hours and crowd change through the day, so this cannot be static.
export const revalidate = 0;

export default async function LandingPage() {
  const supabase = await createClient();
  const [{ data: gym }, user] = await Promise.all([
    supabase
      .from("gyms")
      .select("id, name, join_code, weekly_hours, is_open_override, crowd_level")
      .limit(1)
      .maybeSingle(),
    getUser(),
  ]);

  const hours = parseWeeklyHours(gym?.weekly_hours);

  const weekday = hours.mon;
  const weekend = hours.sat;

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-16 pt-[calc(3rem+env(safe-area-inset-top))]">
      <div className="space-y-3">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          {gym?.name ?? strings.landing.title}
        </h1>
        <p className="text-lg text-balance text-ink">{strings.landing.tagline}</p>
        <p className="text-ink-muted">{strings.landing.lede}</p>
      </div>

      {gym ? (
        <GymLiveProvider
          gymId={gym.id}
          initial={{
            weeklyHours: hours,
            isOpenOverride: gym.is_open_override,
            crowdLevel: gym.crowd_level,
          }}
        >
          <div className="mt-7">
            <LiveHeroStatus />
          </div>

          <div className="mt-2.5">
            <Card className="p-4">
              <LiveCrowdMeter />
            </Card>
          </div>
        </GymLiveProvider>
      ) : null}

      <div className="mt-6">
        <Link
          href={user ? homeFor(user.email) : gym ? `/join?g=${gym.join_code}` : "/join"}
          className="block"
        >
          <Button size="lg" fullWidth>
            {user ? strings.landing.openMemberApp : strings.landing.joinCta}
          </Button>
        </Link>
      </div>

      <section className="mt-9">
        <CardLabel>{strings.landing.hoursHeading}</CardLabel>
        <Card className="mt-2.5 px-5 py-1">
          <HoursRow
            label={strings.landing.weekdays}
            hours={
              weekday
                ? `${formatTime(weekday.open)} to ${formatTime(weekday.close)}`
                : strings.landing.closed
            }
          />
          <HoursRow
            label={strings.landing.weekends}
            hours={
              weekend
                ? `${formatTime(weekend.open)} to ${formatTime(weekend.close)}`
                : strings.landing.closed
            }
          />
        </Card>

        {/* The two-row summary is a simplification; screen readers get the
            actual seven days rather than an approximation of them. */}
        <p className="sr-only">
          {Object.entries(DAY_LABELS)
            .map(([key, label]) => {
              const day = hours[key as keyof typeof hours];
              return `${label}: ${
                day
                  ? `${formatTime(day.open)} to ${formatTime(day.close)}`
                  : strings.landing.closed
              }`;
            })
            .join(". ")}
        </p>
      </section>
    </main>
  );
}

function HoursRow({ label, hours }: { label: string; hours: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border-soft py-3.5 last:border-0">
      <span className="text-ink-muted">{label}</span>
      <span className="font-display font-semibold text-ink">{hours}</span>
    </div>
  );
}
