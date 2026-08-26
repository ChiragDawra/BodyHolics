import { requireStaffSession } from '@/lib/session';
import { listPlans } from '@/features/plans/api';
import { PlanList } from '@/features/plans/components/plan-list';
import { PlanForm } from '@/features/plans/components/plan-form';
import { Card, CardHeader, CardTitle, CardBody, EmptyState } from '@/components/ui';

export const metadata = { title: 'Plans — Urban Gym Admin' };

export default async function PlansPage() {
  const session = await requireStaffSession();
  const plans = await listPlans(session.gymId);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Plans</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          A plan that has been sold cannot be repriced — retire it and add a replacement, so past
          revenue keeps the price it was actually sold at.
        </p>
      </header>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Current plans</CardTitle>
        </CardHeader>
        {plans.length === 0 ? <EmptyState title="No plans yet" /> : <PlanList plans={plans} />}
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Add a plan</CardTitle>
        </CardHeader>
        <CardBody>
          <PlanForm />
        </CardBody>
      </Card>
    </div>
  );
}
