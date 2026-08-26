'use client';

import { useActionState } from 'react';
import { Button, Input, Label } from '@/components/ui';
import { createPlanAction } from '../api';
import type { PlanActionResult } from '../types';

const INITIAL: PlanActionResult = { status: 'idle' };

export function PlanForm() {
  const [state, action, pending] = useActionState(createPlanAction, INITIAL);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="name">Plan name</Label>
        <Input id="name" name="name" required minLength={2} maxLength={80} />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="description">Description</Label>
        <Input id="description" name="description" maxLength={500} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="priceRupees">Price (₹)</Label>
        {/* Typed in rupees, stored in paise. The conversion happens server-side
            so a hand-edited form cannot submit a paise value directly. */}
        <Input
          id="priceRupees"
          name="priceRupees"
          type="number"
          min={0}
          step="0.01"
          required
          className="numeric"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="durationDays">Duration (days)</Label>
        <Input
          id="durationDays"
          name="durationDays"
          type="number"
          min={1}
          max={3650}
          required
          className="numeric"
        />
      </div>

      <input type="hidden" name="sortOrder" value="0" />

      {state.status !== 'idle' ? (
        <p
          role="status"
          className={
            state.status === 'error'
              ? 'text-sm text-danger-500 sm:col-span-2'
              : 'text-sm text-accent-600 sm:col-span-2'
          }
        >
          {state.message}
        </p>
      ) : null}

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Add plan'}
        </Button>
      </div>
    </form>
  );
}
