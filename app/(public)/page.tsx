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
import {
  blocksForDay,
  DAY_KEYS,
  DAY_LABELS,
  formatTime,
  gymIsoWeekday,
  type HourBlock,
} from "@/lib/gym";
import { getGymSchedule } from "@/lib/queries/gym";
import { homeFor } from "@/lib/config";
import { strings } from "@/lib/strings";

// Opening hours and crowd change through the day, so this cannot be static.
export const revalidate = 0;

export default async function LandingPage() {
  const supabase = await createClient();
  const [{ data: gym }, user] = await Promise.all([
    supabase
      .from("gyms")
      .select("id, name, join_code, is_open_override, crowd_override")
      .limit(1)
      .maybeSingle(),
    getUser(),
  ]);

  const schedule = gym
    ? await getGymSchedule(gym.id)
    : { hourBlocks: [], crowdSlots: [] };
  const todayIso = gymIsoWeekday();

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
            hourBlocks: schedule.hourBlocks,
            crowdSlots: schedule.crowdSlots,
            isOpenOverride: gym.is_open_override,
            crowdOverride: gym.crowd_override,
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
          {DAY_KEYS.map((day, index) => (
            <HoursRow
              key={day}
              label={DAY_LABELS[day]}
              blocks={blocksForDay(schedule.hourBlocks, index + 1)}
              today={index + 1 === todayIso}
            />
          ))}
        </Card>
      </section>
    </main>
  );
}

/**
 * One day of the week and every block in it.
 *
 * The old two-row "weekdays / weekends" summary cannot describe a split
 * schedule — it would have to pick one of the two sessions and drop the
 * other. Seven rows is more honest and, since the gap in the middle is the
 * thing people get wrong, more useful.
 */
function HoursRow({
  label,
  blocks,
  today,
}: {
  label: string;
  blocks: HourBlock[];
  today: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border-soft py-3.5 last:border-0">
      <span className={today ? "font-medium text-ink" : "text-ink-muted"}>
        {label}
      </span>

      {blocks.length === 0 ? (
        <span className="text-sm text-ink-dim">{strings.landing.closed}</span>
      ) : (
        <span className="flex flex-col items-end gap-0.5">
          {blocks.map((block) => (
            <span
              key={`${block.start_time}-${block.end_time}`}
              className="font-display text-sm font-semibold text-ink"
            >
              {strings.landing.range(
                formatTime(block.start_time),
                formatTime(block.end_time),
              )}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
