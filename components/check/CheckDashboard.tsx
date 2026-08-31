"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LockIcon, UsersIcon } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/client";
import { GYM_SLUG } from "@/lib/config";
import { checkDashboardSchema, type CheckDashboardData } from "@/lib/schemas/check";
import { CROWD_BG, CROWD_LEVELS, parseWeeklyHours, resolveOpenState, type CrowdLevel } from "@/lib/gym";
import { formatRelative } from "@/lib/format";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/cn";

type Status = "loading" | "ready" | "error";

/**
 * One round trip for the whole screen. Returns null on any failure — network,
 * a rejected PIN, or a payload that no longer matches the schema — so the
 * caller has a single error path instead of three.
 */
async function fetchDashboard(pin: string): Promise<CheckDashboardData | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("check_dashboard", {
    p_gym_slug: GYM_SLUG,
    p_pin: pin,
  });

  if (error) return null;

  const parsed = checkDashboardSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}


/**
 * The owner's dashboard behind the PIN.
 *
 * Every call passes the PIN, which the database re-verifies. There is no
 * session and no anon write policy, so a stale tab cannot change anything
 * without the PIN still being correct.
 */
export function CheckDashboard({
  pin,
  onLock,
}: {
  pin: string;
  onLock: () => void;
}) {
  const [data, setData] = useState<CheckDashboardData | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const result = await fetchDashboard(pin);
    if (result === null) {
      setStatus("error");
      return;
    }
    setData(result);
    setStatus("ready");
  }, [pin]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const result = await fetchDashboard(pin);
      if (cancelled) return;

      if (result === null) {
        setStatus("error");
        return;
      }
      setData(result);
      setStatus("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, [pin]);

  const setCrowd = async (level: CrowdLevel) => {
    if (!data) return;
    setBusy(true);
    setData({ ...data, crowd_level: level }); // optimistic
    const supabase = createClient();
    await supabase.rpc("check_set_crowd", {
      p_gym_slug: GYM_SLUG,
      p_pin: pin,
      p_level: level,
    });
    setBusy(false);
    void load();
  };

  const setOpen = async (open: boolean | null) => {
    if (!data) return;
    setBusy(true);
    setData({ ...data, is_open_override: open });
    const supabase = createClient();
    await supabase.rpc("check_set_open", {
      p_gym_slug: GYM_SLUG,
      p_pin: pin,
      // The SQL parameter is nullable; null clears the override.
      p_open: open as boolean,
    });
    setBusy(false);
    void load();
  };

  if (status === "loading") return <DashboardSkeleton />;

  if (status === "error" || !data) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <ErrorState
          title={strings.common.networkErrorTitle}
          body={strings.common.networkErrorBody}
          action={
            <Button variant="secondary" onClick={() => void load()}>
              {strings.common.retry}
            </Button>
          }
        />
      </div>
    );
  }

  const openState = resolveOpenState(
    parseWeeklyHours(data.weekly_hours),
    data.is_open_override,
  );

  return (
    <div className="pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between gap-3 px-4 pb-3 pt-[calc(1rem+env(safe-area-inset-top))]">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">
            {data.gym_name}
          </h1>
          <p className="text-sm text-ink-muted">{strings.check.title}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onLock}>
          <LockIcon className="h-4 w-4" />
          {strings.check.lock}
        </Button>
      </header>

      <div className="space-y-3 px-4">
        {/* Signature element: the open/closed state, the biggest thing on screen. */}
        <button
          type="button"
          disabled={busy}
          onClick={() => void setOpen(openState.isOpen ? false : true)}
          className={cn(
            "w-full rounded-lg border p-5 text-left transition-colors",
            openState.isOpen
              ? "border-success bg-success-subtle"
              : "border-danger bg-danger-subtle",
          )}
        >
          <span
            className={cn(
              "font-display text-3xl font-bold",
              openState.isOpen ? "text-success" : "text-danger",
            )}
          >
            {openState.isOpen ? strings.check.openNow : strings.check.closedNow}
          </span>
          <span className="mt-1 block text-sm text-ink-muted">
            {openState.overridden
              ? strings.check.overrideNote
              : strings.check.scheduleNote}
          </span>
        </button>

        {data.is_open_override !== null ? (
          <Button
            variant="secondary"
            fullWidth
            disabled={busy}
            onClick={() => void setOpen(null)}
          >
            {strings.check.followSchedule}
          </Button>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardBody className="pt-4">
              <p className="font-display text-3xl font-bold text-ink">
                {data.today_count}
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                {strings.check.todayHeading}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="pt-4">
              <p className="font-display text-3xl font-bold text-ink">
                {data.active_members}
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                {strings.check.activeMembers}
              </p>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader title={strings.check.crowdHeading} />
          <CardBody>
            <div className="grid grid-cols-2 gap-2">
              {CROWD_LEVELS.map((level) => {
                const active = data.crowd_level === level;
                return (
                  <button
                    key={level}
                    type="button"
                    disabled={busy}
                    onClick={() => void setCrowd(level)}
                    aria-pressed={active}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-3 py-3 text-left",
                      "font-display text-sm font-semibold transition-colors",
                      active
                        ? "border-ink bg-surface-sunken text-ink"
                        : "border-border text-ink-muted",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn("h-3 w-3 shrink-0 rounded-full", CROWD_BG[level])}
                    />
                    {strings.member.crowd[level]}
                  </button>
                );
              })}
            </div>
          </CardBody>
        </Card>

        <AlertComposer pin={pin} onSent={() => void load()} />

        <Card>
          <CardHeader title={strings.check.recentHeading} />
          <CardBody>
            {data.recent.length === 0 ? (
              <EmptyState
                icon={<UsersIcon className="h-6 w-6" />}
                title={strings.check.recentEmpty}
                body={strings.check.recentEmptyBody}
              />
            ) : (
              <ul className="divide-y divide-border">
                {data.recent.map((row, i) => (
                  <li
                    key={`${row.checked_in_at}-${i}`}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <span className="truncate text-ink">
                      {row.full_name ?? strings.check.recentEmpty}
                    </span>
                    <span className="shrink-0 text-xs text-ink-muted">
                      {formatRelative(row.checked_in_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function AlertComposer({
  pin,
  onSent,
}: {
  pin: string;
  onSent: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "invalid">("idle");

  const send = async () => {
    if (title.trim() === "") {
      setState("invalid");
      return;
    }

    setState("sending");
    const supabase = createClient();
    const { error } = await supabase.rpc("check_publish_alert", {
      p_gym_slug: GYM_SLUG,
      p_pin: pin,
      p_title: title,
      p_body: body,
    });

    if (error) {
      setState("idle");
      return;
    }

    setTitle("");
    setBody("");
    setState("sent");
    onSent();
    setTimeout(() => setState("idle"), 2000);
  };

  return (
    <Card>
      <CardHeader
        title={strings.check.alertHeading}
        action={state === "sent" ? <Badge tone="success">{strings.check.published}</Badge> : null}
      />
      <CardBody className="space-y-2">
        <label className="block">
          <span className="sr-only">{strings.check.alertTitleLabel}</span>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (state === "invalid") setState("idle");
            }}
            placeholder={strings.check.alertTitlePlaceholder}
            className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-ink placeholder:text-ink-muted"
          />
        </label>
        <label className="block">
          <span className="sr-only">{strings.check.alertBodyLabel}</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={strings.check.alertBodyPlaceholder}
            rows={2}
            className="w-full resize-none rounded-md border border-border bg-surface px-3 py-2.5 text-ink placeholder:text-ink-muted"
          />
        </label>
        {state === "invalid" ? (
          <p role="alert" className="text-sm text-danger">
            {strings.check.alertNeedsTitle}
          </p>
        ) : null}
        <Button
          fullWidth
          disabled={state === "sending"}
          onClick={() => void send()}
        >
          {state === "sending" ? strings.check.publishing : strings.check.publishAlert}
        </Button>
      </CardBody>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-3 px-4 pt-[calc(1rem+env(safe-area-inset-top))]">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  );
}
