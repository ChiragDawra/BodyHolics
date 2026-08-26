'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { publishBroadcastSchema } from '@gym/validation';
import { createClient } from '@/lib/supabase/server';
import { requireStaffSession } from '@/lib/session';
import { invokeFunction, ApiError } from '@/lib/functions';
import type { BroadcastActionResult, BroadcastRow, BroadcastStatus } from './types';

const AUDIENCE_LABELS: Record<string, string> = {
  ALL_MEMBERS: 'All members',
  ACTIVE_MEMBERS: 'Members with a current membership',
  EXPIRING_MEMBERS: 'Members expiring soon',
  INACTIVE_MEMBERS: 'Members without a current membership',
  SELECTED_MEMBERS: 'Selected members',
};

export async function listBroadcasts(gymId: string): Promise<BroadcastRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('broadcasts')
    .select('id, title, category, status, audience, recipient_count, publish_at, published_at, created_at')
    .eq('gym_id', gymId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw new Error('Could not load announcements.');

  return (data ?? []).map((row) => {
    const audienceType =
      typeof row.audience === 'object' && row.audience !== null && 'type' in row.audience
        ? String((row.audience as { type: unknown }).type)
        : 'ALL_MEMBERS';

    return {
      id: row.id,
      title: row.title,
      category: row.category,
      status: row.status as BroadcastStatus,
      audienceLabel: AUDIENCE_LABELS[audienceType] ?? audienceType,
      recipientCount: row.recipient_count,
      publishAt: row.publish_at,
      publishedAt: row.published_at,
      createdAt: row.created_at,
    };
  });
}

/**
 * docs/09 §5 — publishing is the only moment recipients are resolved, and it
 * happens server-side. The client sends the audience *rule*; it never sends a
 * recipient list for the non-SELECTED types, and it never sends a recipient
 * count, which the function computes and writes itself.
 */
export async function publishBroadcastAction(
  _prev: BroadcastActionResult,
  formData: FormData,
): Promise<BroadcastActionResult> {
  await requireStaffSession();

  const audienceType = String(formData.get('audienceType') ?? '');
  const publishAt = formData.get('publishAt');

  const parsed = publishBroadcastSchema.safeParse({
    title: formData.get('title'),
    body: formData.get('body'),
    category: formData.get('category'),
    audience: { type: audienceType },
    ...(typeof publishAt === 'string' && publishAt.length > 0
      ? { publishAt: new Date(publishAt).toISOString() }
      : {}),
  });

  if (!parsed.success) {
    return { status: 'error', message: 'Check the announcement details and try again.' };
  }

  try {
    await invokeFunction('publish-broadcast', parsed.data);
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof ApiError ? error.message : 'Could not send that announcement.',
    };
  }

  revalidatePath('/broadcasts');
  redirect('/broadcasts');
}

export async function publishExistingAction(
  _prev: BroadcastActionResult,
  formData: FormData,
): Promise<BroadcastActionResult> {
  await requireStaffSession();

  const parsed = publishBroadcastSchema.safeParse({ broadcastId: formData.get('broadcastId') });
  if (!parsed.success) {
    return { status: 'error', message: 'Could not identify that announcement.' };
  }

  try {
    await invokeFunction('publish-broadcast', parsed.data);
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof ApiError ? error.message : 'Could not send that announcement.',
    };
  }

  revalidatePath('/broadcasts');
  return { status: 'success', message: 'Announcement sent.' };
}
