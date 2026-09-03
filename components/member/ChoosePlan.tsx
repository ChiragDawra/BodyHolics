import { Card, CardLabel } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CheckList } from "@/components/ui/CheckList";
import { strings } from "@/lib/strings";

export type OfferedPlan = {
  id: string;
  name: string;
  duration_days: number;
  benefits: string[];
  /** The list price. */
  price_paise: number;
  /** What this member would actually pay, after any discount. */
  payable_paise: number;
};

/**
 * What a member with no membership sees instead of a dead end.
 *
 * There is no online payment, so there is no button here that takes money —
 * a "Pay now" that opens nothing is worse than no button. The screen's job is
 * to tell the member what the gym sells and what it costs them specifically,
 * so the conversation at the desk is short.
 */
export function ChoosePlan({ plans }: { plans: OfferedPlan[] }) {
  if (plans.length === 0) {
    return (
      <Card className="p-4.5">
        <CardLabel>{strings.member.choosePlan}</CardLabel>
        <p className="mt-2 text-sm font-medium text-ink">
          {strings.member.noPlans}
        </p>
        <p className="mt-1 text-xs text-ink-dim">{strings.member.noPlansBody}</p>
      </Card>
    );
  }

  return (
    <Card className="p-4.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardLabel>{strings.member.choosePlan}</CardLabel>
          <p className="mt-2 text-sm leading-snug text-ink-muted">
            {strings.member.choosePlanBody}
          </p>
        </div>
        <Badge tone="brand">{strings.member.payAtDesk}</Badge>
      </div>

      <ul className="mt-4 flex flex-col gap-2.5">
        {plans.map((plan) => {
          const discounted = plan.payable_paise < plan.price_paise;

          return (
            <li
              key={plan.id}
              className="rounded-md border border-border bg-surface p-3.5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-display text-base font-bold tracking-tight text-ink">
                  {plan.name}
                </span>

                <span className="flex items-baseline gap-2">
                  {discounted ? (
                    <span className="text-xs text-ink-dim line-through">
                      {strings.common.rupees(plan.price_paise)}
                    </span>
                  ) : null}
                  <span className="font-display text-lg font-bold tracking-tight text-brand">
                    {strings.common.rupees(plan.payable_paise)}
                  </span>
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
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
