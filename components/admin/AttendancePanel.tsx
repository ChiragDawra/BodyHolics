"use client";

import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { CalendarIcon, CheckIcon, SearchIcon } from "@/components/ui/icons";
import { checkInMember, checkOutMember } from "@/lib/actions/admin";
import type { MemberListRow, TodayRow } from "@/lib/queries/admin";
import { formatClock } from "@/lib/format";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/cn";

/**
 * How attendance actually works in this build: a member walks in, staff finds
 * them by name, taps check in. No QR, no camera, no member self-service.
 *
 * The search needs two letters before it lists anyone — with a few hundred
 * members a single letter is a wall of names and staff have a queue waiting.
 *
 * Checking out is the same list: tapping a member who is still in ends their
 * visit, which is what keeps "in the gym now" honest.
 */
export function AttendancePanel({
  gymId,
  members,
  today,
}: {
  gymId: string;
  members: MemberListRow[];
  today: TodayRow[];
}) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const alreadyIn = useMemo(
    () => new Set(today.filter((t) => t.checked_out_at === null).map((t) => t.profile_id)),
    [today],
  );

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return [];

    return members
      .filter(
        (m) =>
          (m.full_name ?? "").toLowerCase().includes(needle) ||
          (m.email ?? "").toLowerCase().includes(needle) ||
          (m.phone ?? "").includes(needle.replace(/\D/g, "")),
      )
      .slice(0, 8);
  }, [members, query]);

  const check = (profileId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await checkInMember({ gymId, profileId });
      if (result.ok) setQuery("");
      else setError(result.message);
    });
  };

  const checkOut = (attendanceId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await checkOutMember(attendanceId);
      if (!result.ok) setError(result.message);
    });
  };

  const inGym = today.filter((t) => t.checked_out_at === null).length;

  return (
    <>
      <div className="grid gap-3.5 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface-raised p-5">
          <p className="font-body text-xs font-medium tracking-wide text-ink-dim">
            {strings.admin.attendance.checkinsToday}
          </p>
          <p className="mt-3.5 font-display text-5xl leading-none font-bold tracking-tighter text-brand">
            {today.length}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface-raised p-5">
          <p className="font-body text-xs font-medium tracking-wide text-ink-dim">
            {strings.admin.attendance.inGymNow}
          </p>
          <p className="mt-3.5 font-display text-5xl leading-none font-bold tracking-tighter text-ink">
            {inGym}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface-raised p-5">
          <p className="mb-3 font-body text-xs font-medium tracking-wide text-ink-dim">
            {strings.admin.attendance.checkSomeoneIn}
          </p>
          <label className="relative block">
            <span className="sr-only">{strings.admin.attendance.searchMember}</span>
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={strings.admin.attendance.searchMember}
              autoComplete="off"
              className="h-11 w-full rounded-md border border-border bg-surface pl-10 pr-3 text-sm text-ink outline-none focus:border-border-strong"
            />
          </label>

          {error ? (
            <p role="alert" className="mt-2 text-xs text-danger">
              {error}
            </p>
          ) : null}

          {query.trim().length >= 2 ? (
            matches.length === 0 ? (
              <p className="mt-3 text-xs text-ink-faint">
                {strings.admin.attendance.noResults}
              </p>
            ) : (
              <ul className="mt-3">
                {matches.map((m) => {
                  const inToday = alreadyIn.has(m.id);
                  return (
                    <li
                      key={m.id}
                      className="flex items-center justify-between gap-3 border-t border-border-soft py-2.5"
                    >
                      <span className="min-w-0 truncate text-sm text-ink">
                        {m.full_name ?? m.email ?? ""}
                      </span>
                      {inToday ? (
                        <Badge tone="success">
                          <CheckIcon className="h-3 w-3" strokeWidth={2.4} />
                          {strings.admin.attendance.alreadyIn}
                        </Badge>
                      ) : (
                        <Button size="sm" disabled={pending} onClick={() => check(m.id)}>
                          {strings.admin.attendance.markPresent}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )
          ) : (
            <p className="mt-3 text-xs text-ink-faint">
              {strings.admin.attendance.searchHint}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3.5 overflow-hidden rounded-lg border border-border bg-surface-raised">
        {today.length === 0 ? (
          <EmptyState
            icon={<CalendarIcon className="h-6 w-6" />}
            title={strings.admin.attendance.empty}
            body={strings.admin.attendance.emptyBody}
          />
        ) : (
          <>
            <div className="hidden grid-cols-[1.4fr_1fr_1fr_0.8fr] gap-4 border-b border-border px-5 py-3 font-body text-[0.625rem] font-medium tracking-wider text-ink-dim lg:grid">
              <span>{strings.admin.attendance.colMember}</span>
              <span>{strings.admin.attendance.colIn}</span>
              <span>{strings.admin.attendance.colOut}</span>
              <span>{strings.admin.attendance.colRecordedBy}</span>
            </div>

            <ul>
              {today.map((row) => (
                <li
                  key={row.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-border-soft px-5 py-3.5 lg:grid-cols-[1.4fr_1fr_1fr_0.8fr] lg:gap-4"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">
                      {row.full_name ?? row.email ?? ""}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-dim lg:hidden">
                      {formatClock(row.checked_in_at)}
                    </span>
                  </span>

                  <span className="hidden font-mono text-xs text-ink-muted lg:block">
                    {formatClock(row.checked_in_at)}
                  </span>

                  <span
                    className={cn(
                      "hidden font-mono text-xs lg:block",
                      row.checked_out_at ? "text-ink-muted" : "text-success",
                    )}
                  >
                    {row.checked_out_at
                      ? formatClock(row.checked_out_at)
                      : strings.admin.attendance.stillIn}
                  </span>

                  <span className="justify-self-end lg:justify-self-start">
                    {row.checked_out_at ? (
                      <span className="text-xs text-ink-dim">
                        {strings.admin.attendance.desk}
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={() => checkOut(row.id)}
                      >
                        {strings.admin.attendance.checkOut}
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}
