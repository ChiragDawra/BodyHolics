'use client';

import { useActionState } from 'react';
import { Badge, Button } from '@/components/ui';
import { TableShell, Th, Td } from '@/components/data-table';
import { updatePlanAction } from '../api';
import type { PlanActionResult, PlanRow } from '../types';

const INITIAL: PlanActionResult = { status: 'idle' };

function formatRupees(paise: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: paise % 100 === 0 ? 0 : 2,
  }).format(paise / 100);
}

export function PlanList({ plans }: { plans: PlanRow[] }) {
  const [state, action] = useActionState(updatePlanAction, INITIAL);

  return (
    <>
      {state.status !== 'idle' ? (
        <p
          role="status"
          className={
            state.status === 'error'
              ? 'px-5 pt-4 text-sm text-danger-500'
              : 'px-5 pt-4 text-sm text-accent-600'
          }
        >
          {state.message}
        </p>
      ) : null}

      <TableShell>
        <thead>
          <tr>
            <Th>Plan</Th>
            <Th>Price</Th>
            <Th>Duration</Th>
            <Th>Status</Th>
            <Th className="text-right">Action</Th>
          </tr>
        </thead>
        <tbody>
          {plans.map((plan) => (
            <tr key={plan.id}>
              <Td>
                <span className="font-medium">{plan.name}</span>
                {plan.description ? (
                  <span className="block text-sm text-[var(--text-muted)]">{plan.description}</span>
                ) : null}
              </Td>
              <Td className="numeric font-medium">
                {formatRupees(plan.pricePaise)}
                {plan.hasSales ? (
                  <span
                    className="block text-xs font-normal text-[var(--text-muted)]"
                    title="This plan has been sold. Repricing it would restate past revenue, so retire it and add a new plan instead."
                  >
                    locked — has sales
                  </span>
                ) : null}
              </Td>
              <Td className="numeric text-[var(--text-muted)]">{plan.durationDays} days</Td>
              <Td>
                <Badge tone={plan.isActive ? 'positive' : 'neutral'}>
                  {plan.isActive ? 'On sale' : 'Retired'}
                </Badge>
              </Td>
              <Td className="text-right">
                <form action={action} className="inline">
                  <input type="hidden" name="planId" value={plan.id} />
                  <input type="hidden" name="isActive" value={plan.isActive ? 'false' : 'true'} />
                  <Button type="submit" variant="secondary" size="sm">
                    {plan.isActive ? 'Retire' : 'Put on sale'}
                  </Button>
                </form>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableShell>
    </>
  );
}
