"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CloseIcon, PlusIcon } from "@/components/ui/icons";
import { replaceCrowdSchedule, replaceHourBlocks } from "@/lib/actions/admin";
import {
  CROWD_BG,
  CROWD_LEVELS,
  DAY_KEYS,
  DAY_LABELS,
  type CrowdLevel,
} from "@/lib/gym";
import type { CrowdSlotRow, HourBlockRow } from "@/lib/queries/gym";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/cn";

/**
 * The opening hours and the crowd timetable, as plain lists.
 *
 * Deliberately not a calendar widget. The owner is describing a weekly
 * pattern that changes twice a year, not booking anything — a grid of
 * draggable blocks would be a lot of interface for "we shut at eleven-thirty
 * and open again at four".
 *
 * Both editors are local until saved and hand the server the complete list,
 * which is why the actions replace rather than diff.
 */

type Row = { key: string; startTime: string; endTime: string };
type CrowdRow = Row & { level: CrowdLevel };

/** A stable key for a row that may not exist in the database yet. */
let counter = 0;
function nextKey(): string {
  counter += 1;
  return `new-${counter}`;
}

/** Postgres hands back "05:30:00"; <input type="time"> wants "05:30". */
function toInputTime(value: string): string {
  return value.slice(0, 5);
}

function groupByDay<T extends { day_of_week: number }>(rows: readonly T[]) {
  return DAY_KEYS.map((_, index) => rows.filter((r) => r.day_of_week === index + 1));
}

export function HoursEditor({
  gymId,
  blocks,
}: {
  gymId: string;
  blocks: HourBlockRow[];
}) {
  const [days, setDays] = useState<Row[][]>(() =>
    groupByDay(blocks).map((rows) =>
      rows.map((b) => ({
        key: b.id,
        startTime: toInputTime(b.start_time),
        endTime: toInputTime(b.end_time),
      })),
    ),
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const edit = (dayIndex: number, next: Row[]) => {
    setDays((prev) => prev.map((rows, i) => (i === dayIndex ? next : rows)));
    setSaved(false);
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await replaceHourBlocks({
        gymId,
        blocks: days.flatMap((rows, i) =>
          rows.map((r) => ({
            dayOfWeek: i + 1,
            startTime: r.startTime,
            endTime: r.endTime,
          })),
        ),
      });

      if (result.ok) setSaved(true);
      else setError(result.message);
    });
  };

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-5">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <p className="font-body text-label font-semibold tracking-label uppercase text-ink-dim">
          {strings.admin.settings.hoursHeading}
        </p>
        {saved ? <Badge tone="success">{strings.admin.settings.saved}</Badge> : null}
      </div>

      <p className="mb-3 text-xs leading-relaxed text-ink-faint">
        {strings.admin.settings.hoursSplitNote}
      </p>

      {days.map((rows, dayIndex) => (
        <div key={DAY_KEYS[dayIndex]} className="border-t border-border-soft py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-ink">
              {DAY_LABELS[DAY_KEYS[dayIndex]!]}
            </span>
            <button
              type="button"
              onClick={() =>
                edit(dayIndex, [
                  ...rows,
                  { key: nextKey(), startTime: "05:30", endTime: "11:30" },
                ])
              }
              className="flex items-center gap-1 font-body text-xs font-medium text-brand hover:text-brand-hover"
            >
              <PlusIcon className="h-3.5 w-3.5" strokeWidth={2.2} />
              {strings.admin.settings.addRange}
            </button>
          </div>

          {rows.length === 0 ? (
            <p className="mt-1.5 text-xs text-ink-faint">
              {strings.admin.settings.closedAllDay}
            </p>
          ) : (
            <div className="mt-2 flex flex-col gap-2">
              {rows.map((row, rowIndex) => (
                <TimeRange
                  key={row.key}
                  row={row}
                  label={DAY_LABELS[DAY_KEYS[dayIndex]!]!}
                  onChange={(next) =>
                    edit(
                      dayIndex,
                      rows.map((r, i) => (i === rowIndex ? { ...r, ...next } : r)),
                    )
                  }
                  onRemove={() =>
                    edit(
                      dayIndex,
                      rows.filter((_, i) => i !== rowIndex),
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>
      ))}

      {error ? (
        <p role="alert" className="mt-3 text-xs text-danger">
          {error}
        </p>
      ) : null}

      <Button className="mt-4" disabled={pending} onClick={save}>
        {pending ? strings.admin.settings.saving : strings.admin.settings.save}
      </Button>
    </div>
  );
}

export function CrowdScheduleEditor({
  gymId,
  slots,
}: {
  gymId: string;
  slots: CrowdSlotRow[];
}) {
  const [days, setDays] = useState<CrowdRow[][]>(() =>
    groupByDay(slots).map((rows) =>
      rows.map((s) => ({
        key: s.id,
        startTime: toInputTime(s.start_time),
        endTime: toInputTime(s.end_time),
        level: s.level,
      })),
    ),
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const edit = (dayIndex: number, next: CrowdRow[]) => {
    setDays((prev) => prev.map((rows, i) => (i === dayIndex ? next : rows)));
    setSaved(false);
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await replaceCrowdSchedule({
        gymId,
        slots: days.flatMap((rows, i) =>
          rows.map((r) => ({
            dayOfWeek: i + 1,
            startTime: r.startTime,
            endTime: r.endTime,
            level: r.level,
          })),
        ),
      });

      if (result.ok) setSaved(true);
      else setError(result.message);
    });
  };

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-5">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <p className="font-body text-label font-semibold tracking-label uppercase text-ink-dim">
          {strings.admin.settings.crowdScheduleHeading}
        </p>
        {saved ? <Badge tone="success">{strings.admin.settings.saved}</Badge> : null}
      </div>

      <p className="mb-3 text-xs leading-relaxed text-ink-faint">
        {strings.admin.settings.crowdScheduleNote}
      </p>

      {days.map((rows, dayIndex) => (
        <div key={DAY_KEYS[dayIndex]} className="border-t border-border-soft py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-ink">
              {DAY_LABELS[DAY_KEYS[dayIndex]!]}
            </span>
            <button
              type="button"
              onClick={() =>
                edit(dayIndex, [
                  ...rows,
                  {
                    key: nextKey(),
                    startTime: "07:00",
                    endTime: "08:00",
                    level: "moderate",
                  },
                ])
              }
              className="flex items-center gap-1 font-body text-xs font-medium text-brand hover:text-brand-hover"
            >
              <PlusIcon className="h-3.5 w-3.5" strokeWidth={2.2} />
              {strings.admin.settings.addCrowdSlot}
            </button>
          </div>

          <div className="mt-2 flex flex-col gap-2">
            {rows.map((row, rowIndex) => {
              const update = (next: Partial<CrowdRow>) =>
                edit(
                  dayIndex,
                  rows.map((r, i) => (i === rowIndex ? { ...r, ...next } : r)),
                );

              return (
                <div key={row.key} className="flex flex-wrap items-center gap-2">
                  <TimeRange
                    row={row}
                    label={DAY_LABELS[DAY_KEYS[dayIndex]!]!}
                    onChange={update}
                    onRemove={() =>
                      edit(
                        dayIndex,
                        rows.filter((_, i) => i !== rowIndex),
                      )
                    }
                    trailing={
                      <span className="flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className={cn(
                            "h-1.5 w-1.5 flex-none rounded-full",
                            CROWD_BG[row.level],
                          )}
                        />
                        <select
                          value={row.level}
                          aria-label={strings.admin.settings.crowdHeading}
                          onChange={(e) =>
                            update({ level: e.target.value as CrowdLevel })
                          }
                          className="rounded-sm border border-border bg-surface px-2 py-1.5 text-xs text-ink-muted outline-none focus:border-border-strong"
                        >
                          {CROWD_LEVELS.map((level) => (
                            <option key={level} value={level}>
                              {strings.member.crowd[level]}
                            </option>
                          ))}
                        </select>
                      </span>
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {error ? (
        <p role="alert" className="mt-3 text-xs text-danger">
          {error}
        </p>
      ) : null}

      <Button className="mt-4" disabled={pending} onClick={save}>
        {pending ? strings.admin.settings.saving : strings.admin.settings.save}
      </Button>
    </div>
  );
}

function TimeRange({
  row,
  label,
  onChange,
  onRemove,
  trailing,
}: {
  row: Row;
  label: string;
  onChange: (next: { startTime?: string; endTime?: string }) => void;
  onRemove: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="time"
        aria-label={`${label} ${strings.admin.settings.openLabel}`}
        value={row.startTime}
        onChange={(e) => onChange({ startTime: e.target.value })}
        className="rounded-sm border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-ink-muted outline-none focus:border-border-strong"
      />
      <span aria-hidden className="text-xs text-ink-faint">
        &ndash;
      </span>
      <input
        type="time"
        aria-label={`${label} ${strings.admin.settings.closeLabel}`}
        value={row.endTime}
        onChange={(e) => onChange({ endTime: e.target.value })}
        className="rounded-sm border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-ink-muted outline-none focus:border-border-strong"
      />

      {trailing}

      <button
        type="button"
        onClick={onRemove}
        aria-label={strings.admin.settings.removeRange}
        title={strings.admin.settings.removeRange}
        className="flex h-7 w-7 items-center justify-center rounded-full text-ink-dim transition-colors hover:bg-surface-overlay hover:text-danger"
      >
        <CloseIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
