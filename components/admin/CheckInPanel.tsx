"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { CheckIcon, SearchIcon, CalendarIcon } from "@/components/ui/icons";
import { checkInMember, undoCheckIn } from "@/lib/actions/admin";
import type { MemberListRow } from "@/lib/queries/admin";
import { formatClock } from "@/lib/format";
import { strings } from "@/lib/strings";

export type TodayRow = {
  id: string;
  checked_in_at: string;
  profile_id: string;
  full_name: string | null;
  email: string | null;
};

/**
 * How attendance actually works in this build: a member walks in, staff finds
 * them by name, and taps check in. No QR, no camera, no member self-service.
 *
 * The search needs two letters before it lists anyone — with a few hundred
 * members, a single letter is a wall of names and staff have a queue waiting.
 */
export function CheckInPanel({
  gymId,
  members,
  today,
}: {
  gymId: string;
  members: MemberListRow[];
  today: TodayRow[];
}) {
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const alreadyIn = useMemo(
    () => new Set(today.map((t) => t.profile_id)),
    [today],
  );

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length < 2) return [];

    return members
      .filter(
        (m) =>
          (m.full_name ?? "").toLowerCase().includes(needle) ||
          (m.email ?? "").toLowerCase().includes(needle),
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

  const undo = (attendanceId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await undoCheckIn(attendanceId);
      if (!result.ok) setError(result.message);
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title={strings.admin.attendance.checkInHeading} />
        <CardBody className="space-y-3">
          <label className="relative block">
            <span className="sr-only">{strings.admin.attendance.searchMember}</span>
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={strings.admin.attendance.searchMember}
              autoComplete="off"
              className="w-full rounded-md border border-border bg-surface py-2.5 pl-10 pr-3 text-ink placeholder:text-ink-muted"
            />
          </label>

          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}

          {query.trim().length < 2 ? (
            <p className="text-sm text-ink-muted">
              {strings.admin.attendance.searchHint}
            </p>
          ) : matches.length === 0 ? (
            <EmptyState
              title={strings.admin.attendance.noResults}
              body={strings.admin.attendance.noResultsBody}
            />
          ) : (
            <ul className="divide-y divide-border">
              {matches.map((m) => {
                const inToday = alreadyIn.has(m.id);
                return (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-display font-semibold text-ink">
                        {m.full_name ?? m.email ?? ""}
                      </p>
                      <p className="truncate text-xs text-ink-muted">{m.email ?? ""}</p>
                    </div>

                    {inToday ? (
                      <Badge tone="success">
                        <CheckIcon className="h-3.5 w-3.5" />
                        {strings.admin.attendance.alreadyIn}
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        disabled={pending}
                        onClick={() => check(m.id)}
                      >
                        {strings.admin.attendance.checkIn}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={strings.admin.attendance.todayHeading}
          action={
            <span className="text-sm text-ink-muted">
              {strings.admin.attendance.count(today.length)}
            </span>
          }
        />
        <CardBody>
          {today.length === 0 ? (
            <EmptyState
              icon={<CalendarIcon className="h-6 w-6" />}
              title={strings.admin.attendance.empty}
              body={strings.admin.attendance.emptyBody}
            />
          ) : (
            <ul className="max-h-[32rem] divide-y divide-border overflow-y-auto">
              {today.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-display font-semibold text-ink">
                      {row.full_name ?? row.email ?? ""}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {formatClock(row.checked_in_at)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => undo(row.id)}
                  >
                    {strings.admin.attendance.undo}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
