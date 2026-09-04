import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/auth";
import { Button } from "@/components/ui/Button";
import { Card, CardLabel } from "@/components/ui/Card";
import { CheckList } from "@/components/ui/CheckList";
import { QuotesWall } from "@/components/public/QuotesWall";
import {
  GymLiveProvider,
  LiveCrowdMeter,
  LiveHeroStatus,
  LiveOpenPill,
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

/**
 * The public front door.
 *
 * The first screen is the launch screen: the mark on a wall of slogans, and
 * the two ways in. Everything a person actually needs to decide — whether it
 * is open right now, how busy, what it costs — is directly under it rather
 * than behind a tap, because those are the questions someone standing outside
 * a gym is asking.
 *
 * Below `lg` the launch screen takes the full viewport and the detail scrolls
 * under it. Above `lg` they sit side by side, so a laptop is not asked to
 * scroll past a splash to read the opening hours.
 */
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

  const [schedule, { data: planRows }] = await Promise.all([
    gym ? getGymSchedule(gym.id) : { hourBlocks: [], crowdSlots: [] },
    gym
      ? supabase
          .from("plans")
          .select("id, name, price_paise, duration_days, benefits")
          .eq("gym_id", gym.id)
          .eq("is_active", true)
          .order("duration_days", { ascending: true })
      : { data: [] },
  ]);

  const plans = planRows ?? [];
  const todayIso = gymIsoWeekday();

  const joinHref = user
    ? homeFor(user.email)
    : gym
      ? `/join?g=${gym.join_code}`
      : "/join";

  const details = (
    <div className="flex flex-col gap-2.5">
      <LiveHeroStatus />

      <Card className="p-4">
        <LiveCrowdMeter />
      </Card>

      <section className="mt-4">
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

      {plans.length > 0 ? (
        <section className="mt-4">
          <CardLabel>{strings.landing.plansHeading}</CardLabel>
          <div className="mt-2.5 flex flex-col gap-2.5">
            {plans.map((plan) => (
              <Card key={plan.id} className="p-4.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-display text-base font-bold tracking-tight text-ink">
                    {plan.name}
                  </span>
                  <span className="font-display text-lg font-bold tracking-tight text-brand">
                    {strings.common.rupees(plan.price_paise)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-ink-dim">
                  {strings.member.planFor(
                    strings.landing.perDuration(plan.duration_days),
                  )}
                </p>
                {plan.benefits.length > 0 ? (
                  <div className="mt-3">
                    <CheckList items={plan.benefits} />
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
          <p className="mt-2.5 px-1 text-xs text-ink-faint">
            {strings.landing.plansNote}
          </p>
        </section>
      ) : null}
    </div>
  );

  const body = (
    <main className="relative z-10 mx-auto w-full max-w-md px-5 pb-16 lg:max-w-5xl lg:px-8">
      <div className="lg:grid lg:grid-cols-[1fr_1.05fr] lg:items-start lg:gap-12 lg:pt-14">
        {/* ---------------------------------------------------- launch screen */}
        <div className="flex min-h-dvh flex-col lg:sticky lg:top-14 lg:min-h-0">
          <header className="flex items-center justify-between gap-3 pt-[calc(1.75rem+env(safe-area-inset-top))]">
            <span className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="h-2 w-2 rounded-full bg-brand animate-[bh-pulse_2.4s_ease-in-out_infinite]"
              />
              <span className="font-body text-label font-bold tracking-label uppercase text-ink-muted">
                {strings.landing.clubMark}
              </span>
            </span>

            {/* The mock-up put a "24/7 ACCESS" chip here. This gym is not
                open 24/7 — it shuts at 11:30 and again at 10 — so the chip
                carries the real state instead. */}
            <LiveOpenPill />
          </header>

          <div className="flex flex-1 items-center justify-center py-10">
            <div className="relative w-full max-w-[21rem]">
              <span
                aria-hidden
                className="absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/12 blur-3xl"
              />
              {/*
                The artwork carries its own alpha, so it needs none of the
                mix-blend-mode the mock-up used to hide a black background.
              */}
              <Image
                src="/brand/bodyholic-mark.png"
                alt={gym?.name ?? strings.landing.title}
                width={1000}
                height={705}
                priority
                className="relative h-auto w-full drop-shadow-[0_0_28px_rgba(185,174,255,0.22)]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2.5 pb-8">
            <Link href={joinHref} className="block">
              <Button size="lg" fullWidth>
                {user ? strings.landing.openMemberApp : strings.landing.joinNewCta}
              </Button>
            </Link>

            <Link href="/join" className="block">
              <Button size="lg" variant="secondary" fullWidth>
                {strings.landing.existingCta}
              </Button>
            </Link>

            <p className="pt-1 text-center text-xs text-ink-faint lg:hidden">
              {strings.landing.scrollHint}
            </p>
          </div>
        </div>

        {/* --------------------------------------------- what people came for */}
        <div className="pb-4 lg:pt-2">{details}</div>
      </div>
    </main>
  );

  return (
    <>
      <QuotesWall />
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
          {body}
        </GymLiveProvider>
      ) : (
        body
      )}
    </>
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
