"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { TagIcon, PlusIcon } from "@/components/ui/icons";
import { createPlan, togglePlan, updatePlan } from "@/lib/actions/admin";
import { strings } from "@/lib/strings";

export type PlanRow = {
  id: string;
  name: string;
  price_paise: number;
  duration_days: number;
  is_active: boolean;
};

export function PlansManager({
  gymId,
  plans,
}: {
  gymId: string;
  plans: PlanRow[];
}) {
  const [editing, setEditing] = useState<PlanRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = (plan: PlanRow) => {
    setError(null);
    startTransition(async () => {
      const result = await togglePlan({ planId: plan.id, isActive: !plan.is_active });
      if (!result.ok) setError(result.message);
    });
  };

  return (
    <div className="space-y-4">
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      {creating || editing ? (
        <PlanForm
          gymId={gymId}
          plan={editing}
          onDone={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      ) : (
        <Button onClick={() => setCreating(true)}>
          <PlusIcon className="h-5 w-5" />
          {strings.admin.plans.newPlan}
        </Button>
      )}

      {plans.length === 0 ? (
        <EmptyState
          icon={<TagIcon className="h-6 w-6" />}
          title={strings.admin.plans.empty}
          body={strings.admin.plans.emptyBody}
        />
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {plans.map((plan) => (
              <li
                key={plan.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="font-display font-semibold text-ink">{plan.name}</p>
                  <p className="text-sm text-ink-muted">
                    {strings.common.rupees(plan.price_paise)} ·{" "}
                    {strings.landing.perDuration(plan.duration_days)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge tone={plan.is_active ? "success" : "neutral"}>
                    {plan.is_active
                      ? strings.admin.plans.active
                      : strings.admin.plans.inactive}
                  </Badge>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(plan)}>
                    {strings.admin.plans.editPlan}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => toggle(plan)}
                  >
                    {plan.is_active
                      ? strings.admin.plans.deactivate
                      : strings.admin.plans.activate}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-sm text-ink-muted">{strings.admin.plans.inactiveNote}</p>
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
  const [rupees, setRupees] = useState(
    plan ? String(plan.price_paise / 100) : "",
  );
  const [days, setDays] = useState(plan ? String(plan.duration_days) : "30");
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
      };

      const result = plan
        ? await updatePlan({ ...payload, planId: plan.id })
        : await createPlan(payload);

      if (result.ok) onDone();
      else setError(result.message);
    });
  };

  return (
    <Card>
      <CardHeader
        title={plan ? strings.admin.plans.editPlan : strings.admin.plans.newPlan}
      />
      <CardBody className="space-y-3">
        <Field label={strings.admin.plans.name}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={strings.admin.plans.namePlaceholder}
            className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-ink placeholder:text-ink-muted"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={strings.admin.plans.price}>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={rupees}
              onChange={(e) => setRupees(e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-ink"
            />
          </Field>
          <Field label={strings.admin.plans.duration}>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-ink"
            />
          </Field>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <Button onClick={submit} disabled={pending}>
            {pending ? strings.admin.plans.saving : strings.admin.plans.save}
          </Button>
          <Button variant="ghost" onClick={onDone}>
            {strings.common.cancel}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-display text-sm font-semibold text-ink">
        {label}
      </span>
      {children}
    </label>
  );
}
