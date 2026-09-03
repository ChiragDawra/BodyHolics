import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/auth";
import { Button } from "@/components/ui/Button";
import { Card, CardLabel } from "@/components/ui/Card";
import { CheckList } from "@/components/ui/CheckList";
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

/**
 * The public front door.
 *
 * Answers, in order, the three things someone standing outside actually wants
 * to know: is it open right now, how busy is it, and what does it cost. Then
 * the two ways in — join as a member, or sign in as staff.
 *
 * One column on a phone, two from `lg` up. The rest of the public flow is
 * phone-shaped because it is scanned off a QR code on the wall, but this page
 * is also what someone opens on a laptop after being told the gym's name.
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

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-20 pt-[calc(3rem+env(safe-area-inset-top))] lg:max-w-5xl lg:px-8 lg:pt-16">
      <div className="lg:grid lg:grid-cols-[1fr_1.1fr] lg:items-start lg:gap-10">
        {/* Who this is, and the way in. */}
        <div className="lg:sticky lg:top-16">
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink lg:text-5xl lg:tracking-tighter">
            {gym?.name ?? strings.landing.title}
          </h1>
          <p className="mt-3 text-lg text-balance text-ink lg:text-xl">
            {strings.landing.tagline}
          </p>
          <p className="mt-2.5 text-ink-muted">{strings.landing.lede}</p>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row lg:flex-col">
            <Link
              href={
                user ? homeFor(user.email) : gym ? `/join?g=${gym.join_code}` : "/join"
              }
              className="block sm:flex-1 lg:flex-none"
            >
              <Button size="lg" fullWidth>
                {user ? strings.landing.openMemberApp : strings.landing.joinCta}
              </Button>
            </Link>

            {/* The second door. Members never need it; staff always do. */}
            <Link href="/admin/login" className="block sm:flex-1 lg:flex-none">
              <Button size="lg" variant="secondary" fullWidth>
                {strings.landing.staffCta}
              </Button>
            </Link>
          </div>
        </div>

        {/* Live status, hours, prices. */}
        <div className="mt-9 lg:mt-0">
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
              <LiveHeroStatus />

              <div className="mt-2.5">
                <Card className="p-4">
                  <LiveCrowdMeter />
                </Card>
              </div>
            </GymLiveProvider>
          ) : null}

          <section className="mt-7">
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
            <section className="mt-7">
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
      </div>
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
