import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/auth";
import { CheckCircleIcon } from "@/components/ui/icons";
import { AutoReturn } from "@/components/member/AutoReturn";
import { formatClock } from "@/lib/format";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/cn";

export const metadata = { title: strings.checkin.title };
export const dynamic = "force-dynamic";

/**
 * What the QR code on the gym door points at.
 *
 * The physical code encodes this URL and nothing else — no member id, no
 * token, no expiry. It is the same sticker for everyone and can be
 * photographed freely, because who is checking in comes from the session
 * cookie, not from the code. A stolen photo lets you check yourself in, which
 * is the feature.
 *
 * The write happens during the render of a GET, which is normally a mistake.
 * It is safe here precisely because of the 30-minute rule: `check_in_self()`
 * is idempotent within that window, so a prefetch, a double render, or a
 * member refreshing the page records one visit, not three.
 */
export default async function CheckInPage() {
  const user = await getUser();

  // Sign in first, then come straight back here rather than landing on /app.
  if (!user) redirect(`/join?next=${encodeURIComponent("/checkin")}`);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_in_self");

  const result = data?.[0] ?? null;

  if (error || !result) {
    return (
      <Screen tone="danger" icon={<CheckCircleIcon className="h-10 w-10" />}>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          {strings.checkin.failedTitle}
        </h1>
        <p className="mt-3 text-base text-balance text-ink-muted">
          {strings.checkin.failedBody}
        </p>
      </Screen>
    );
  }

  const time = formatClock(result.at_time);

  return (
    <Screen tone="brand" icon={<CheckCircleIcon className="h-10 w-10" />}>
      <h1 className="font-display text-4xl font-bold tracking-tighter text-ink">
        {result.created ? strings.checkin.done : strings.checkin.alreadyTitle}
      </h1>

      <p className="mt-3 text-lg text-ink-muted">
        {result.created
          ? strings.checkin.at(time)
          : strings.checkin.alreadyAt(time)}
      </p>

      <p className="mt-2 text-sm text-ink-dim">
        {result.created ? strings.checkin.doneBody : strings.checkin.alreadyBody}
      </p>

      <p className="mt-9 text-xs text-ink-faint">{strings.checkin.returning}</p>

      <AutoReturn to="/app" afterMs={2200} />
    </Screen>
  );
}

/** Full screen, one thing on it, readable at arm's length in a doorway. */
function Screen({
  tone,
  icon,
  children,
}: {
  tone: "brand" | "danger";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-7 text-center">
      <span
        aria-hidden
        className={cn(
          "flex h-20 w-20 items-center justify-center rounded-full",
          "animate-[bh-dot_0.4s_cubic-bezier(0.22,1,0.36,1)_both]",
          tone === "brand" ? "bg-brand/15 text-brand" : "bg-danger/15 text-danger",
        )}
      >
        {icon}
      </span>

      <div className="bh-rise mt-7">{children}</div>
    </main>
  );
}
