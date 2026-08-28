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
// It is also not `seed-demo-owner.mjs`, which trades the password rules here for
// something typeable during a demo. This is the script that runs against the
// gym's real project.
//
//   node scripts/bootstrap-gym.mjs
//
// Reads supabase/.env.production, which you create and git ignores. The service
// key never leaves your machine.

import { createInterface } from 'node:readline/promises';
import {
  loadEnv,
  createClient,
  ensureAuthUser,
  ensureStaff,
  audit,
} from './lib/supabase-admin.mjs';

const env = loadEnv();
const db = createClient(env);

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = async (question, fallback) => {
  const answer = (await rl.question(fallback ? `${question} [${fallback}]: ` : `${question}: `)).trim();
  return answer || fallback || '';
};

console.log(`\nBootstrapping ${env.url}\n`);

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
  const existingGyms = await db.rest(`gyms?slug=eq.${encodeURIComponent(gymSlug)}&select=id,name`);
  let gym = existingGyms[0];

  if (gym) {
    console.log(`\n· gym "${gym.name}" already exists — reusing it`);
  } else {
    [gym] = await db.rest('gyms', {
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
  const existingHours = await db.rest(`gym_hours?gym_id=eq.${gym.id}&select=weekday`);
  if (existingHours.length === 0) {
    await db.rest('gym_hours', {
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
  const owner = await ensureAuthUser(db, {
    email: ownerEmail,
    password: ownerPassword,
    name: ownerName,
  });
  console.log(
    owner.created
      ? '✓ created the owner auth account'
      : '· owner auth account already exists — reusing it',
  );

  const staff = await ensureStaff(db, {
    gymId: gym.id,
    userId: owner.id,
    name: ownerName,
    email: ownerEmail,
    role: 'OWNER',
  });
  console.log(staff.granted ? '✓ granted OWNER' : `· already ${staff.role} — left alone`);

  await audit(db, {
    gymId: gym.id,
    actorUserId: owner.id,
    action: 'GYM_BOOTSTRAPPED',
    entityType: 'gym',
    entityId: gym.id,
    metadata: { slug: gym.slug ?? gymSlug, owner_email: ownerEmail.toLowerCase() },
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
