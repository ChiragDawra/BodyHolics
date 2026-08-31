"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { startMembership } from "@/lib/actions/admin";
import { strings } from "@/lib/strings";

export type PlanOption = {
  id: string;
  name: string;
  price_paise: number;
  duration_days: number;
};

/**
 * Gives a member a plan. The end date is derived from the plan's duration in
 * the server action, so there is no date field to get wrong here.
 */
export function StartMembershipForm({
  gymId,
  profileId,
  plans,
}: {
  gymId: string;
  profileId: string;
  plans: PlanOption[];
}) {
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (plans.length === 0) return null;

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await startMembership({ gymId, profileId, planId });
      if (!result.ok) setError(result.message);
    });
  };

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1.5 block font-display text-sm font-semibold text-ink">
          {strings.member.plan}
        </span>
        <select
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          className="w-full rounded-md border border-border bg-surface-raised px-3 py-2.5 text-ink"
        >
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} — {strings.common.rupees(plan.price_paise)} ·{" "}
              {strings.landing.perDuration(plan.duration_days)}
            </option>
          ))}
        </select>
      </label>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button onClick={submit} disabled={pending}>
        {pending ? strings.admin.plans.saving : strings.admin.members.startMembership}
      </Button>
    </div>
  );
}
