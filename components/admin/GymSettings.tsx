"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { GymStatusControls } from "@/components/admin/GymStatusControls";
import { CopyIcon, PlusIcon } from "@/components/ui/icons";
import { createPlan, togglePlan, updateHours, updatePlan } from "@/lib/actions/admin";
import {
  DAY_KEYS,
  DAY_LABELS,
  type CrowdLevel,
  type DayKey,
  type OpenState,
  type WeeklyHours,
} from "@/lib/gym";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/cn";

export type PlanRow = {
  id: string;
  name: string;
  price_paise: number;
  duration_days: number;
  is_active: boolean;
  benefits: string[];
};

export type StaffRow = {
  id: string;
  role: "owner" | "staff";
  email: string | null;
  full_name: string | null;
};

/**
 * Everything the owner changes rarely, on one page.
 *
 * Hours, the open/closed override, crowd, plans, and the staff list. The two
 * things changed often — open/closed and crowd — also appear on the dashboard,
 * because making the owner navigate here to flip the gym closed at 8pm would
 * mean it never gets flipped.
 */
export function GymSettings({
  gymId,
  joinCode,
  openState,
  crowdLevel,
  initialHours,
  plans,
  staff,
  staffCode,
}: {
  gymId: string;
  joinCode: string;
  openState: OpenState;
  crowdLevel: CrowdLevel;
  initialHours: WeeklyHours;
  plans: PlanRow[];
  staff: StaffRow[];
  staffCode: string | null;
}) {
  const [hours, setHours] = useState<WeeklyHours>(initialHours);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState<PlanRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();

  const setDay = (day: DayKey, next: { open: string; close: string } | null) => {
    setHours((prev) => ({ ...prev, [day]: next }));
    setSaved(false);
  };

  const saveHours = () => {
    setError(null);
    startTransition(async () => {
      const payload = Object.fromEntries(DAY_KEYS.map((d) => [d, hours[d] ?? null]));
      const result = await updateHours({ gymId, weeklyHours: payload });
      if (result.ok) setSaved(true);
      else setError(result.message);
    });
  };

  const toggle = (plan: PlanRow) => {
    setError(null);
    startTransition(async () => {
      const result = await togglePlan({ planId: plan.id, isActive: !plan.is_active });
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
      // Clipboard can be blocked; the link is on screen either way.
    }
  };

  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-[1.1fr_1fr]">
      {error ? (
        <p role="alert" className="text-sm text-danger lg:col-span-2">
          {error}
        </p>
      ) : null}

      {/* Opening hours */}
      <div className="rounded-lg border border-border bg-surface-raised p-5">
        <div className="mb-3.5 flex items-center justify-between gap-3">
          <p className="font-body text-label font-semibold tracking-label uppercase text-ink-dim">
            {strings.admin.settings.hoursHeading}
          </p>
          {saved ? <Badge tone="success">{strings.admin.settings.saved}</Badge> : null}
        </div>

        {DAY_KEYS.map((day) => {
          const value = hours[day] ?? null;
          return (
            <div
              key={day}
              className="grid grid-cols-[1fr_auto] items-center gap-3 border-t border-border-soft py-2.5 sm:grid-cols-[1fr_auto_auto]"
            >
              <span className="text-sm font-medium text-ink">{DAY_LABELS[day]}</span>

              {value ? (
                <>
                  <input
                    type="time"
                    aria-label={`${DAY_LABELS[day]} ${strings.admin.settings.openLabel}`}
                    value={value.open}
                    onChange={(e) => setDay(day, { ...value, open: e.target.value })}
                    className="rounded-sm border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-ink-muted outline-none focus:border-border-strong"
                  />
                  <input
                    type="time"
                    aria-label={`${DAY_LABELS[day]} ${strings.admin.settings.closeLabel}`}
                    value={value.close}
                    onChange={(e) => setDay(day, { ...value, close: e.target.value })}
                    className="rounded-sm border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-ink-muted outline-none focus:border-border-strong"
                  />
                </>
              ) : (
                <span className="col-span-2 justify-self-end text-xs text-ink-faint">
                  {strings.admin.settings.closedLabel}
                </span>
              )}

              <label className="col-span-2 flex items-center gap-2 text-xs text-ink-dim sm:col-span-3">
                <input
                  type="checkbox"
                  checked={value === null}
                  onChange={(e) =>
                    setDay(day, e.target.checked ? null : { open: "06:00", close: "22:00" })
                  }
                  className="h-3.5 w-3.5 accent-[var(--color-brand)]"
                />
                {strings.admin.settings.closedLabel}
              </label>
            </div>
          );
        })}

        <Button className="mt-4" disabled={pending} onClick={saveHours}>
          {pending ? strings.admin.settings.saving : strings.admin.settings.save}
        </Button>
      </div>

      <div className="flex flex-col gap-3.5">
        {/* Override + crowd, the same controls as the dashboard. */}
        <div className="rounded-lg border border-border bg-surface-raised p-5">
          <GymStatusControls
            gymId={gymId}
            openState={openState}
            crowdLevel={crowdLevel}
          />
          <p className="pt-1 text-xs text-ink-dim">
            {strings.admin.settings.overrideNote}
          </p>
        </div>

        {/* Plans */}
        <div className="rounded-lg border border-border bg-surface-raised p-5">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <p className="font-body text-label font-semibold tracking-label uppercase text-ink-dim">
              {strings.admin.settings.plansHeading}
            </p>
            <button
              type="button"
              onClick={() => {
                setCreating(true);
                setEditing(null);
              }}
              className="font-body text-xs font-medium text-brand hover:text-brand-hover"
            >
              {strings.admin.settings.newPlan}
            </button>
          </div>

          {creating || editing ? (
            <PlanForm
              gymId={gymId}
              plan={editing}
              onDone={() => {
                setCreating(false);
                setEditing(null);
              }}
            />
          ) : null}

          {plans.map((plan) => (
            <div
              key={plan.id}
              className="flex items-center justify-between gap-3 border-t border-border-soft py-2.5"
            >
              <span className="min-w-0">
                <span
                  className={cn(
                    "text-sm font-medium",
                    plan.is_active ? "text-ink" : "text-ink-dim",
                  )}
                >
                  {plan.name}
                </span>
                <span className="text-xs text-ink-dim">
                  {" · "}
                  {strings.landing.perDuration(plan.duration_days)}
                </span>
              </span>

              <span className="flex flex-none items-center gap-2">
                <span className="font-display text-sm font-medium text-ink">
                  {strings.common.rupees(plan.price_paise)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(plan);
                    setCreating(false);
                  }}
                  className="font-body text-xs font-medium text-ink-dim hover:text-ink"
                >
                  {strings.admin.settings.editPlan}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => toggle(plan)}
                  className={cn(
                    "font-body text-xs font-medium",
                    plan.is_active
                      ? "text-ink-dim hover:text-danger"
                      : "text-success hover:text-success",
                  )}
                >
                  {plan.is_active
                    ? strings.admin.settings.deactivate
                    : strings.admin.settings.activate}
                </button>
              </span>
            </div>
          ))}
        </div>

        {/* Staff */}
        <div className="rounded-lg border border-border bg-surface-raised p-5">
          <p className="mb-1.5 font-body text-label font-semibold tracking-label uppercase text-ink-dim">
            {strings.admin.settings.staffHeading}
          </p>

          {staff.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 border-t border-border-soft py-2.5"
            >
              <span className="min-w-0 truncate text-xs text-ink-muted">
                {s.email ?? s.full_name ?? ""}
              </span>
              <span
                className={cn(
                  "flex-none font-body text-xs font-medium",
                  s.role === "owner" ? "text-brand" : "text-ink-dim",
                )}
              >
                {s.role === "owner"
                  ? strings.admin.settings.owner
                  : strings.admin.settings.staff}
              </span>
            </div>
          ))}

          {staffCode ? (
            <div className="mt-3.5 border-t border-border-soft pt-3.5">
              <p className="font-body text-label font-semibold tracking-label uppercase text-ink-dim">
                {strings.admin.settings.staffCodeLabel}
              </p>
              <code className="mt-2 block rounded-sm bg-surface px-3 py-2 font-mono text-sm tracking-widest text-ink">
                {staffCode}
              </code>
            </div>
          ) : null}

          <p className="mt-2.5 text-xs leading-relaxed text-ink-faint">
            {strings.admin.settings.staffCodeNote}
          </p>
        </div>

        {/* Join link */}
        <div className="rounded-lg border border-border bg-surface-raised p-5">
          <p className="font-body text-label font-semibold tracking-label uppercase text-ink-dim">
            {strings.admin.settings.joinHeading}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-ink-dim">
            {strings.admin.settings.joinNote}
          </p>
          <code className="mt-3 block overflow-x-auto rounded-sm bg-surface px-3 py-2.5 font-mono text-xs text-ink">
            /join?g={joinCode}
          </code>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => void copyJoinLink()}
          >
            <CopyIcon className="h-4 w-4" />
            {copied ? strings.admin.settings.copied : strings.admin.settings.copyLink}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PlanForm({
  gymId,
  plan,
  onDone,
}: {
  gymId: string;
  plan: PlanRow | null;
  onDone: () => void;
}) {
  const [name, setName] = useState(plan?.name ?? "");
  const [rupees, setRupees] = useState(plan ? String(plan.price_paise / 100) : "");
  const [days, setDays] = useState(plan ? String(plan.duration_days) : "30");
  const [benefits, setBenefits] = useState((plan?.benefits ?? []).join("\n"));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const payload = {
        gymId,
        name,
        priceRupees: rupees,
        durationDays: days,
        benefits,
      };
      const result = plan
        ? await updatePlan({ ...payload, planId: plan.id })
        : await createPlan(payload);

      if (result.ok) onDone();
      else setError(result.message);
    });
  };

  return (
    <div className="mb-3 rounded-md border border-border bg-surface p-3.5">
      <div className="flex flex-col gap-2.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={strings.admin.settings.planNamePlaceholder}
          aria-label={strings.admin.settings.planName}
          className="h-10 w-full rounded-sm border border-border bg-surface-raised px-3 text-sm text-ink outline-none focus:border-border-strong"
        />
        <div className="grid grid-cols-2 gap-2.5">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={rupees}
            onChange={(e) => setRupees(e.target.value)}
            aria-label={strings.admin.settings.planPrice}
            placeholder={strings.admin.settings.planPrice}
            className="h-10 w-full rounded-sm border border-border bg-surface-raised px-3 text-sm text-ink outline-none focus:border-border-strong"
          />
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            aria-label={strings.admin.settings.planDuration}
            placeholder={strings.admin.settings.planDuration}
            className="h-10 w-full rounded-sm border border-border bg-surface-raised px-3 text-sm text-ink outline-none focus:border-border-strong"
          />
        </div>

        <label className="block">
          <span className="mb-1.5 block font-body text-label font-semibold tracking-label uppercase text-ink-dim">
            {strings.admin.settings.planBenefits}
          </span>
          <textarea
            value={benefits}
            onChange={(e) => setBenefits(e.target.value)}
            rows={4}
            placeholder={strings.admin.settings.planBenefitsPlaceholder}
            className="w-full resize-y rounded-sm border border-border bg-surface-raised px-3 py-2.5 text-sm leading-relaxed text-ink outline-none focus:border-border-strong"
          />
          <span className="mt-1.5 block text-xs text-ink-faint">
            {strings.admin.settings.planBenefitsHint}
          </span>
        </label>

        {error ? (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <Button size="sm" disabled={pending} onClick={submit}>
            <PlusIcon className="h-3.5 w-3.5" strokeWidth={2.2} />
            {pending ? strings.admin.settings.saving : strings.admin.settings.planSave}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDone}>
            {strings.common.cancel}
          </Button>
        </div>
      </div>
    </div>
  );
}
