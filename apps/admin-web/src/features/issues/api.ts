'use server';

import { revalidatePath } from 'next/cache';
import { replyToIssueSchema, updateIssueStatusSchema } from '@gym/validation';
import { createClient } from '@/lib/supabase/server';
import { requireStaffSession } from '@/lib/session';
import { invokeFunction, ApiError } from '@/lib/functions';
import type { IssueActionResult, IssueDetail, IssueRow, IssueStatus } from './types';

/**
 * docs/07 §7 — reads are a direct RLS-protected select, writes go through
 * `reply-to-issue` and `update-issue-status`. The status transitions have side
 * effects (acknowledged_at, a member notification, an audit row) that must
 * happen in one server-side transaction, so they are not table writes.
 */

export async function listIssues(gymId: string, status: string | undefined): Promise<IssueRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from('issues')
    .select('id, title, category, status, created_at, acknowledged_at, profiles!issues_user_id_fkey(full_name)')
    .eq('gym_id', gymId)
    .order('created_at', { ascending: false })
    .limit(200);

  const allowed: IssueStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
  if (status && (allowed as string[]).includes(status)) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw new Error('Could not load issues.');

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    status: row.status as IssueStatus,
    memberName: row.profiles?.full_name ?? 'Member',
    createdAt: row.created_at,
    acknowledgedAt: row.acknowledged_at,
  }));
}

export async function getIssue(gymId: string, issueId: string): Promise<IssueDetail | null> {
  const supabase = await createClient();

  const [issue, messages] = await Promise.all([
    supabase
      .from('issues')
      .select(
        'id, title, category, status, description, created_at, acknowledged_at, resolved_at, profiles!issues_user_id_fkey(full_name)',
      )
      .eq('gym_id', gymId)
      .eq('id', issueId)
      .maybeSingle(),
    supabase
      .from('issue_messages')
      .select('id, author_role, body, created_at, profiles!issue_messages_author_user_id_fkey(full_name)')
      .eq('issue_id', issueId)
      .order('created_at', { ascending: true }),
  ]);

  if (!issue.data) return null;

  return {
    id: issue.data.id,
    title: issue.data.title,
    category: issue.data.category,
    status: issue.data.status as IssueStatus,
    description: issue.data.description,
    memberName: issue.data.profiles?.full_name ?? 'Member',
    createdAt: issue.data.created_at,
    acknowledgedAt: issue.data.acknowledged_at,
    resolvedAt: issue.data.resolved_at,
    messages: (messages.data ?? []).map((row) => ({
      id: row.id,
      authorName: row.profiles?.full_name ?? 'Staff',
      authorRole: row.author_role as 'MEMBER' | 'STAFF',
      body: row.body,
      createdAt: row.created_at,
    })),
  };
}

export async function replyToIssueAction(
  _prev: IssueActionResult,
  formData: FormData,
): Promise<IssueActionResult> {
  await requireStaffSession();

  const parsed = replyToIssueSchema.safeParse({
    issueId: formData.get('issueId'),
    body: formData.get('body'),
  });

  if (!parsed.success) {
    return { status: 'error', message: 'Write a reply between 1 and 2000 characters.' };
  }

  try {
    await invokeFunction('reply-to-issue', parsed.data);
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof ApiError ? error.message : 'Could not send that reply.',
    };
  }

  revalidatePath(`/issues/${parsed.data.issueId}`);
  return { status: 'success', message: 'Reply sent.' };
}

export async function updateIssueStatusAction(
  _prev: IssueActionResult,
  formData: FormData,
): Promise<IssueActionResult> {
  await requireStaffSession();

  const message = formData.get('message');
  const parsed = updateIssueStatusSchema.safeParse({
    issueId: formData.get('issueId'),
    status: formData.get('status'),
    ...(typeof message === 'string' && message.length > 0 ? { message } : {}),
  });

  if (!parsed.success) {
    // Closing requires a message (docs/07 §7); the schema is what says so.
    return { status: 'error', message: 'Closing an issue needs a short explanation.' };
  }

  try {
    await invokeFunction('update-issue-status', parsed.data);
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof ApiError ? error.message : 'Could not update that issue.',
    };
  }

  revalidatePath(`/issues/${parsed.data.issueId}`);
  revalidatePath('/issues');
  return { status: 'success', message: 'Issue updated.' };
}
