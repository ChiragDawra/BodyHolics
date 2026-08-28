#!/usr/bin/env node
// Creates the gym, its opening hours, its plans, and the first OWNER account in
// a hosted environment.
//
// docs/04 §4 — "Bootstrapping the first OWNER is a manual, audited SQL insert in
// each environment — not a signup flow." This is that, made repeatable so it is
// not typed by hand into a SQL editor at 11pm.
//
// It is deliberately NOT the development seed. That file invents five members
// and fake payments; this creates exactly one gym and one owner and nothing else.
//
//   node scripts/bootstrap-gym.mjs
//
// Reads supabase/.env.production, which you create and git ignores. The service
// key never leaves your machine.

import { readFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = join(ROOT, 'supabase/.env.production');

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
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set in supabase/.env.production');
  process.exit(1);
}

/** Anything that reaches the database goes through here, service-key only. */
async function rest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...options.headers,
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} → ${response.status}: ${text}`);
  }
  return body;
}

async function admin(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`auth ${path} → ${response.status}: ${text}`);
  return body;
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = async (question, fallback) => {
  const answer = (await rl.question(fallback ? `${question} [${fallback}]: ` : `${question}: `)).trim();
  return answer || fallback || '';
};

console.log(`\nBootstrapping ${SUPABASE_URL}\n`);

const gymName = await ask('Gym name', 'Urban Gym');
const gymSlug = await ask('Gym slug (lowercase, used in the QR code)', 'urban-gym');
const gymPhone = await ask('Gym contact phone (E.164, optional)', '');
const gymAddress = await ask('Gym address (optional)', '');
const ownerEmail = await ask('Owner email (they sign in to the admin with this)');
const ownerName = await ask('Owner full name');
const ownerPassword = await ask('Owner password (min 12 chars, save it somewhere safe)');

if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(gymSlug)) {
  console.error('\nSlug must be lowercase letters, numbers and hyphens (3–40 chars).');
  process.exit(1);
}
if (!ownerEmail || !ownerPassword || ownerPassword.length < 12) {
  console.error('\nAn owner email and a password of at least 12 characters are required.');
  process.exit(1);
}

rl.close();

try {
  // ---- gym -------------------------------------------------------------
  const existingGyms = await rest(`gyms?slug=eq.${encodeURIComponent(gymSlug)}&select=id,name`);
  let gym = existingGyms[0];

  if (gym) {
    console.log(`\n· gym "${gym.name}" already exists — reusing it`);
  } else {
    [gym] = await rest('gyms', {
      method: 'POST',
      body: JSON.stringify({
        slug: gymSlug,
        name: gymName,
        timezone: 'Asia/Kolkata',
        phone: gymPhone || null,
        address: gymAddress || null,
      }),
    });
    console.log(`\n✓ created gym "${gym.name}"`);
  }

  // ---- opening hours ---------------------------------------------------
  // Sensible defaults so the app has something real to show; the owner edits
  // them in Settings. Sunday closed, weekdays 06:00–22:00, Saturday 07:00–21:00.
  const existingHours = await rest(`gym_hours?gym_id=eq.${gym.id}&select=weekday`);
  if (existingHours.length === 0) {
    await rest('gym_hours', {
      method: 'POST',
      body: JSON.stringify(
        Array.from({ length: 7 }, (_, weekday) => ({
          gym_id: gym.id,
          weekday,
          is_closed: weekday === 0,
          opens_at: weekday === 0 ? null : weekday === 6 ? '07:00' : '06:00',
          closes_at: weekday === 0 ? null : weekday === 6 ? '21:00' : '22:00',
        })),
      ),
    });
    console.log('✓ set default opening hours (edit them in Settings)');
  } else {
    console.log('· opening hours already set — left alone');
  }

  // ---- owner account ---------------------------------------------------
  const found = await admin(`admin/users?filter=${encodeURIComponent(ownerEmail)}`);
  let ownerId = found?.users?.find((u) => u.email?.toLowerCase() === ownerEmail.toLowerCase())?.id;

  if (ownerId) {
    console.log('· owner auth account already exists — reusing it');
  } else {
    const created = await admin('admin/users', {
      method: 'POST',
      body: JSON.stringify({
        email: ownerEmail,
        password: ownerPassword,
        // Confirmed on creation: this account is created by the operator, not
        // by someone claiming the address, so there is nothing to verify.
        email_confirm: true,
      }),
    });
    ownerId = created.id;
    console.log('✓ created the owner auth account');
  }

  // The profile carries the identity; the gym_staff row carries the power.
  await rest('profiles', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ id: ownerId, full_name: ownerName, email: ownerEmail.toLowerCase() }),
  });

  const existingStaff = await rest(`gym_staff?gym_id=eq.${gym.id}&user_id=eq.${ownerId}&select=id,role`);
  if (existingStaff.length === 0) {
    await rest('gym_staff', {
      method: 'POST',
      body: JSON.stringify({ gym_id: gym.id, user_id: ownerId, role: 'OWNER', status: 'ACTIVE' }),
    });
    console.log('✓ granted OWNER');
  } else {
    console.log(`· already ${existingStaff[0].role} — left alone`);
  }

  // docs/04 §13 — a privileged write, so it is attributable. Never the password.
  await rest('audit_logs', {
    method: 'POST',
    body: JSON.stringify({
      gym_id: gym.id,
      actor_user_id: ownerId,
      action: 'GYM_BOOTSTRAPPED',
      entity_type: 'gym',
      entity_id: gym.id,
      metadata: { slug: gym.slug ?? gymSlug, owner_email: ownerEmail.toLowerCase() },
    }),
  });

  console.log(`
Done.

  Gym id    ${gym.id}
  Slug      ${gymSlug}
  Admin     sign in with ${ownerEmail}

  The member QR code should encode exactly:  ${gymSlug}

Next: add at least one membership plan from the admin console (Plans), or
members will have nothing to buy.
`);
} catch (error) {
  console.error('\nBootstrap failed:', error.message);
  process.exit(1);
}
