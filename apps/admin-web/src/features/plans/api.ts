'use server';

import { revalidatePath } from 'next/cache';
import { createPlanSchema, updatePlanSchema } from '@gym/validation';
import { createClient } from '@/lib/supabase/server';
import { requireStaffSession } from '@/lib/session';
import type { PlanRow, PlanActionResult } from './types';

/**
 * Plans are a plain RLS-protected table (docs/07 §Transport), so reads and
 * writes go through PostgREST rather than an Edge Function. The staff check is
 * still made twice: once here for a clear error, and once by the policy, which
 * is the one that actually decides.
 */

export async function listPlans(gymId: string): Promise<PlanRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('membership_plans')
    .select('id, name, description, price_paise, duration_days, is_active, sort_order')
    .eq('gym_id', gymId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw new Error('Could not load plans.');

  // Sold plans cannot be repriced in place; the trigger enforces it, and the UI
  // needs to know so it can explain why the field is locked.
  const { data: sold } = await supabase
    .from('memberships')
    .select('plan_id')
    .eq('gym_id', gymId);
  const soldPlanIds = new Set((sold ?? []).map((row) => row.plan_id));

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    pricePaise: row.price_paise,
    durationDays: row.duration_days,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    hasSales: soldPlanIds.has(row.id),
  }));
}

export async function createPlanAction(
  _prev: PlanActionResult,
  formData: FormData,
): Promise<PlanActionResult> {
  const session = await requireStaffSession();

  // The form sends rupees because that is what a person types; it becomes paise
  // here and stays an integer from this point on (CLAUDE.md rule 6).
  const rupees = Number(formData.get('priceRupees'));
  if (!Number.isFinite(rupees) || rupees < 0) {
    return { status: 'error', message: 'Enter a price in rupees.' };
  }

  const parsed = createPlanSchema.safeParse({
    name: formData.get('name'),
    ...(formData.get('description') ? { description: formData.get('description') } : {}),
    pricePaise: Math.round(rupees * 100),
    durationDays: Number(formData.get('durationDays')),
    sortOrder: Number(formData.get('sortOrder') ?? 0),
  });

  if (!parsed.success) {
    return { status: 'error', message: 'Check the plan details and try again.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('membership_plans').insert({
    gym_id: session.gymId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    price_paise: parsed.data.pricePaise,
    duration_days: parsed.data.durationDays,
    sort_order: parsed.data.sortOrder,
  });

  if (error) return { status: 'error', message: 'Could not save the plan.' };

  revalidatePath('/plans');
  return { status: 'success', message: `${parsed.data.name} added.` };
}

export async function updatePlanAction(
  _prev: PlanActionResult,
  formData: FormData,
): Promise<PlanActionResult> {
  await requireStaffSession();

  // Note the absence of a price field. Repricing a sold plan would restate past
  // revenue, so the way to change a price is to retire the plan and add a new
  // one (docs/01 §6.3). The DB trigger refuses it regardless of what is sent.
  const parsed = updatePlanSchema.safeParse({
    planId: formData.get('planId'),
    ...(formData.get('name') ? { name: formData.get('name') } : {}),
    ...(formData.get('description') ? { description: formData.get('description') } : {}),
    ...(formData.get('sortOrder') !== null ? { sortOrder: Number(formData.get('sortOrder')) } : {}),
    isActive: formData.get('isActive') === 'true',
  });

  if (!parsed.success) {
    return { status: 'error', message: 'Check the plan details and try again.' };
  }

  const { planId, ...changes } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from('membership_plans')
    .update({
      ...(changes.name !== undefined ? { name: changes.name } : {}),
      ...(changes.description !== undefined ? { description: changes.description } : {}),
      ...(changes.sortOrder !== undefined ? { sort_order: changes.sortOrder } : {}),
      ...(changes.isActive !== undefined ? { is_active: changes.isActive } : {}),
    })
    .eq('id', planId);

  if (error) return { status: 'error', message: 'Could not update the plan.' };

  revalidatePath('/plans');
  return { status: 'success', message: 'Plan updated.' };
}
