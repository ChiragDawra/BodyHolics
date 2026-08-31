"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CopyIcon } from "@/components/ui/icons";
import { setCrowdLevel, setOpenOverride, updateHours } from "@/lib/actions/admin";
import {
  CROWD_BG,
  CROWD_LEVELS,
  DAY_KEYS,
  DAY_LABELS,
  type CrowdLevel,
  type DayKey,
  type WeeklyHours,
} from "@/lib/gym";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/cn";

export function GymSettingsForm({
  gymId,
  joinCode,
  initialHours,
  initialOverride,
  initialCrowd,
}: {
  gymId: string;
  joinCode: string;
  initialHours: WeeklyHours;
  initialOverride: boolean | null;
  initialCrowd: CrowdLevel;
}) {
  const [hours, setHours] = useState<WeeklyHours>(initialHours);
  const [override, setOverride] = useState(initialOverride);
  const [crowd, setCrowd] = useState(initialCrowd);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const setDay = (day: DayKey, next: { open: string; close: string } | null) => {
    setHours((prev) => ({ ...prev, [day]: next }));
    setSaved(false);
  };

  const saveHours = () => {
    setError(null);
    startTransition(async () => {
      const payload = Object.fromEntries(
        DAY_KEYS.map((d) => [d, hours[d] ?? null]),
      );
      const result = await updateHours({ gymId, weeklyHours: payload });
      if (result.ok) setSaved(true);
      else setError(result.message);
    });
  };

  const applyOverride = (value: boolean | null) => {
    setOverride(value);
    setError(null);
    startTransition(async () => {
      const result = await setOpenOverride({ gymId, isOpen: value });
      if (!result.ok) setError(result.message);
    });
  };

  const applyCrowd = (level: CrowdLevel) => {
    setCrowd(level);
    setError(null);
    startTransition(async () => {
      const result = await setCrowdLevel({ gymId, level });
      if (!result.ok) setError(result.message);
    });
  };

  const copyJoinLink = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/join?g=${joinCode}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the link is visible on screen either way.
    }
  };

  return (
    <div className="space-y-6">
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Card>
        <CardHeader title={strings.admin.settings.overrideHeading} />
        <CardBody className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <OverrideButton
              active={override === null}
              onClick={() => applyOverride(null)}
              disabled={pending}
              label={strings.admin.settings.followSchedule}
            />
            <OverrideButton
              active={override === true}
              onClick={() => applyOverride(true)}
              disabled={pending}
              label={strings.admin.settings.forceOpen}
              tone="success"
            />
            <OverrideButton
              active={override === false}
              onClick={() => applyOverride(false)}
              disabled={pending}
              label={strings.admin.settings.forceClosed}
              tone="danger"
            />
          </div>
          <p className="text-sm text-ink-muted">
            {strings.admin.settings.overrideNote}
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={strings.admin.settings.crowdHeading} />
        <CardBody>
          <div className="flex flex-wrap gap-2">
            {CROWD_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                disabled={pending}
                onClick={() => applyCrowd(level)}
                aria-pressed={crowd === level}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2",
                  "font-display text-sm font-semibold transition-colors",
                  crowd === level
                    ? "border-ink bg-surface-sunken text-ink"
                    : "border-border text-ink-muted hover:text-ink",
                )}
              >
                <span aria-hidden className={cn("h-2.5 w-2.5 rounded-full", CROWD_BG[level])} />
                {strings.member.crowd[level]}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={strings.admin.settings.hoursHeading}
          action={saved ? <Badge tone="success">{strings.admin.settings.saved}</Badge> : null}
        />
        <CardBody className="space-y-3">
          <p className="text-sm text-ink-muted">{strings.admin.settings.hoursNote}</p>

          <div className="space-y-2">
            {DAY_KEYS.map((day) => {
              const value = hours[day] ?? null;
              return (
                <div
                  key={day}
                  className="flex flex-wrap items-center gap-3 border-b border-border pb-2 last:border-0"
                >
                  <span className="w-24 shrink-0 font-display text-sm font-semibold text-ink">
                    {DAY_LABELS[day]}
                  </span>

                  <label className="flex items-center gap-2 text-sm text-ink-muted">
                    <input
                      type="checkbox"
                      checked={value === null}
                      onChange={(e) =>
                        setDay(day, e.target.checked ? null : { open: "06:00", close: "22:00" })
                      }
                      className="h-4 w-4 accent-[var(--color-brand)]"
                    />
                    {strings.admin.settings.closedLabel}
                  </label>

                  {value ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        aria-label={`${DAY_LABELS[day]} ${strings.admin.settings.openLabel}`}
                        value={value.open}
                        onChange={(e) => setDay(day, { ...value, open: e.target.value })}
                        className="rounded-md border border-border bg-surface px-2 py-1.5 text-ink"
                      />
                      <span className="text-ink-muted">to</span>
                      <input
                        type="time"
                        aria-label={`${DAY_LABELS[day]} ${strings.admin.settings.closeLabel}`}
                        value={value.close}
                        onChange={(e) => setDay(day, { ...value, close: e.target.value })}
                        className="rounded-md border border-border bg-surface px-2 py-1.5 text-ink"
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <Button onClick={saveHours} disabled={pending}>
            {pending ? strings.admin.settings.saving : strings.admin.settings.save}
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={strings.admin.settings.joinHeading} />
        <CardBody className="space-y-3">
          <p className="text-sm text-ink-muted">{strings.admin.settings.joinNote}</p>
          <code className="block overflow-x-auto rounded-md bg-surface-sunken px-3 py-2.5 text-sm text-ink">
            /join?g={joinCode}
          </code>
          <Button variant="secondary" onClick={() => void copyJoinLink()}>
            <CopyIcon className="h-5 w-5" />
            {copied ? strings.admin.settings.copied : strings.admin.settings.copyLink}
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}

function OverrideButton({
  active,
  onClick,
  disabled,
  label,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  disabled: boolean;
  label: string;
  tone?: "success" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "rounded-md border px-3 py-2 font-display text-sm font-semibold transition-colors",
        active
          ? tone === "success"
            ? "border-success bg-success-subtle text-success"
            : tone === "danger"
              ? "border-danger bg-danger-subtle text-danger"
              : "border-ink bg-surface-sunken text-ink"
          : "border-border text-ink-muted hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}
