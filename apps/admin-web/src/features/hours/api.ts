'use server';

import { revalidatePath } from 'next/cache';
import { updateGymHoursSchema } from '@gym/validation';
import { createClient } from '@/lib/supabase/server';
import { requireStaffSession } from '@/lib/session';
import type { HoursActionResult, HoursRow } from './types';

/**
 * gym_hours is an RLS-protected table with a staff write policy, so this goes
 * through PostgREST rather than an Edge Function (docs/07 §Transport).
 *
 * The times are gym-local wall clock — `time` columns, not timestamps. A gym
 * that opens at 06:00 opens at 06:00 whatever the server thinks the date is.
 */
export async function listHours(gymId: string): Promise<HoursRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('gym_hours')
    .select('weekday, opens_at, closes_at, is_closed')
    .eq('gym_id', gymId)
    .order('weekday', { ascending: true });

  if (error) throw new Error('Could not load opening hours.');

  // Always seven rows, so a gym with a missing day still renders a full week
  // rather than silently omitting it.
  return Array.from({ length: 7 }, (_, weekday) => {
    const row = (data ?? []).find((candidate) => candidate.weekday === weekday);
    return {
      weekday,
      opensAt: row?.opens_at?.slice(0, 5) ?? null,
      closesAt: row?.closes_at?.slice(0, 5) ?? null,
      isClosed: row?.is_closed ?? true,
    };
  });
}

export async function updateHoursAction(
  _prev: HoursActionResult,
  formData: FormData,
): Promise<HoursActionResult> {
  const session = await requireStaffSession();

  const hours = Array.from({ length: 7 }, (_, weekday) => {
    const closed = formData.get(`closed-${weekday}`) === 'on';
    const opensAt = formData.get(`opens-${weekday}`);
    const closesAt = formData.get(`closes-${weekday}`);

    return {
      weekday,
      isClosed: closed,
      opensAt: closed || typeof opensAt !== 'string' || !opensAt ? null : opensAt,
      closesAt: closed || typeof closesAt !== 'string' || !closesAt ? null : closesAt,
    };
  });

  // The shared schema enforces seven rows, seven distinct weekdays, and that an
  // open day has both times with close after open — the same rules the
  // `hours_present_when_open` check constraint enforces, so a form that passes
  // here is one the database will accept.
  const parsed = updateGymHoursSchema.safeParse({ hours });

  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Each open day needs an opening and a closing time, and closing must be later.',
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.from('gym_hours').upsert(
    parsed.data.hours.map((day) => ({
      gym_id: session.gymId,
      weekday: day.weekday,
      opens_at: day.opensAt,
      closes_at: day.closesAt,
      is_closed: day.isClosed,
    })),
    { onConflict: 'gym_id,weekday' },
  );

  if (error) return { status: 'error', message: 'Could not save the opening hours.' };

  revalidatePath('/settings/hours');
  return { status: 'success', message: 'Opening hours saved.' };
}
