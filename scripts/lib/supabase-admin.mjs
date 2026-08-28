// Service-key access to a hosted Supabase project, shared by the scripts in
// `scripts/`.
//
// Extracted so `bootstrap-gym.mjs` and `seed-demo-owner.mjs` cannot drift: they
// create the same rows in the same tables, and two copies of that logic is two
// chances for one of them to forget the audit row.
//
// This module is Node-only and never bundled into either app. The service key it
// carries bypasses every RLS policy in the database (CLAUDE.md rule 3), so it is
// read from a gitignored file on the operator's machine and nowhere else.

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const ENV_FILE = join(ROOT, 'supabase/.env.production');

/**
 * Reads `supabase/.env.production`, which the operator creates and git ignores.
 * Exits with instructions rather than a stack trace when it is missing — this is
 * the first thing anyone hits.
 */
export function loadEnv() {
  if (!existsSync(ENV_FILE)) {
    console.error(`Missing ${ENV_FILE}.\n\nCreate it with:\n`);
    console.error('  SUPABASE_URL=https://<ref>.supabase.co');
    console.error('  SUPABASE_SERVICE_ROLE_KEY=<service_role key from the dashboard>\n');
    process.exit(1);
  }

  const env = Object.fromEntries(
    readFileSync(ENV_FILE, 'utf8')
      .split('\n')
      .filter((line) => line.trim() && !line.startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=');
        return [
          line.slice(0, index).trim(),
          line
            .slice(index + 1)
            .trim()
            .replace(/^["']|["']$/g, ''),
        ];
      }),
  );

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set in supabase/.env.production',
    );
    process.exit(1);
  }

  return { url: env.SUPABASE_URL.replace(/\/$/, ''), serviceKey: env.SUPABASE_SERVICE_ROLE_KEY };
}

/** True for a local Supabase stack, which is the only safe place for weak demo data. */
export function isLocal(url) {
  return /^https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\])(:|\/|$)/.test(url);
}

export function createClient({ url, serviceKey }) {
  const authHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  /** Anything that reaches the database goes through here, service-key only. */
  async function rest(path, options = {}) {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      ...options,
      headers: { ...authHeaders, Prefer: 'return=representation', ...options.headers },
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${options.method ?? 'GET'} ${path} → ${response.status}: ${text}`);
    }
    return text ? JSON.parse(text) : null;
  }

  /** The GoTrue admin API — creating users, setting passwords. */
  async function admin(path, options = {}) {
    const response = await fetch(`${url}/auth/v1/${path}`, {
      ...options,
      headers: { ...authHeaders, ...options.headers },
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`auth ${path} → ${response.status}: ${text}`);
    return text ? JSON.parse(text) : null;
  }

  return { rest, admin, url };
}

/**
 * Finds an auth user by email, or creates one.
 *
 * `email_confirm: true` because the account is created by the operator, not by
 * someone claiming the address — there is nobody to send a verification link to.
 * It also matters downstream: `verifiedIdentity()` only trusts an identity whose
 * `*_confirmed_at` is set, so an unconfirmed account would sign in and then be
 * treated as having no identity at all (D-021).
 */
export async function ensureAuthUser({ admin }, { email, password, name }) {
  const found = await admin(`admin/users?filter=${encodeURIComponent(email)}`);
  const existing = found?.users?.find((user) => user.email?.toLowerCase() === email.toLowerCase());

  if (existing) return { id: existing.id, created: false };

  const created = await admin('admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: name ? { full_name: name } : {},
    }),
  });

  return { id: created.id, created: true };
}

/** Idempotent: the profile carries the identity, the `gym_staff` row carries the power. */
export async function ensureStaff({ rest }, { gymId, userId, name, email, role = 'OWNER' }) {
  await rest('profiles', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ id: userId, full_name: name, email: email.toLowerCase() }),
  });

  const existing = await rest(
    `gym_staff?gym_id=eq.${gymId}&user_id=eq.${userId}&select=id,role,status`,
  );

  if (existing.length > 0) return { granted: false, role: existing[0].role };

  await rest('gym_staff', {
    method: 'POST',
    body: JSON.stringify({ gym_id: gymId, user_id: userId, role, status: 'ACTIVE' }),
  });

  return { granted: true, role };
}

/** docs/04 §13 — a privileged write, so it is attributable. Never the password. */
export async function audit({ rest }, { gymId, actorUserId, action, entityType, entityId, metadata }) {
  await rest('audit_logs', {
    method: 'POST',
    body: JSON.stringify({
      gym_id: gymId,
      actor_user_id: actorUserId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata: metadata ?? {},
    }),
  });
}
