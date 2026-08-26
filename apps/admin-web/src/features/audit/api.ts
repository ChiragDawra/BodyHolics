import { createClient } from '@/lib/supabase/server';

export type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorName: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

/**
 * The audit trail. OWNER-only by policy (docs/05 §8), append-only by design —
 * there is no UPDATE or DELETE policy on this table for any role.
 *
 * A staff member who is not the owner gets an empty list rather than an error:
 * RLS simply returns no rows, which is the correct answer to "show me the audit
 * log" when you are not permitted to see it.
 */
export async function listAuditLog(gymId: string): Promise<AuditRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, action, entity_type, entity_id, metadata, created_at, actor_user_id')
    .eq('gym_id', gymId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw new Error('Could not load the audit log.');

  const actorIds = [
    ...new Set((data ?? []).map((row) => row.actor_user_id).filter((id): id is string => !!id)),
  ];

  const names = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', actorIds);
    for (const profile of profiles ?? []) names.set(profile.id, profile.full_name);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    // A null actor is the scheduler, not a person — cron publishes broadcasts
    // and expires memberships with no actor_user_id.
    actorName: row.actor_user_id ? (names.get(row.actor_user_id) ?? null) : null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
  }));
}
