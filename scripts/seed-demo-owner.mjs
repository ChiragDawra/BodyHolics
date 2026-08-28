#!/usr/bin/env node
// Seeds a demonstrable gym: one gym, its opening hours, three plans, and an
// OWNER account that signs in with a short username instead of an email.
//
//   node scripts/seed-demo-owner.mjs                        # local stack
//   node scripts/seed-demo-owner.mjs --yes-this-is-a-demo-gym   # hosted project
//
// THIS IS NOT `bootstrap-gym.mjs`. That script is the production path: it asks
// for a real address, insists on a twelve-character password, and is meant to be
// run once against the gym's real project. This one exists so the app can be put
// in front of the owner today, with a credential that is easy to type on a phone
// at the counter.
//
// The credential it creates is deliberately weak. Everything below is arranged
// so that weakness cannot quietly end up guarding real members' data:
//
//   · a hosted target needs an explicit flag, so it cannot happen by autocomplete;
//   · it refuses outright once the gym has members, because at that point the
//     database holds real phone numbers and this password no longer protects
//     anything;
//   · the account it creates is a normal Supabase account with a normal password
//     — there is no bypass, no hardcoded check in the client, and nothing to
//     remove later. Changing the password in the dashboard is the whole of
//     "hardening" it.

import { parseArgs } from 'node:util';
import {
  loadEnv,
  isLocal,
  createClient,
  ensureAuthUser,
  ensureStaff,
  audit,
} from './lib/supabase-admin.mjs';

const { values } = parseArgs({
  options: {
    username: { type: 'string', default: 'ChiragDawra' },
    password: { type: 'string', default: '12345678' },
    domain: { type: 'string', default: 'staff.bodyholics.app' },
    name: { type: 'string', default: 'Chirag Dawra' },
    'gym-name': { type: 'string', default: 'BodyHolics' },
    'gym-slug': { type: 'string', default: 'bodyholics' },
    'yes-this-is-a-demo-gym': { type: 'boolean', default: false },
  },
});

const username = values.username.trim();
const password = values.password;
const gymSlug = values['gym-slug'];
const gymName = values['gym-name'];

// The same completion the login form does, and it has to agree with
// NEXT_PUBLIC_ADMIN_USERNAME_DOMAIN or the username resolves to an address that
// was never created.
const ownerEmail = `${username.toLowerCase()}@${values.domain}`;

if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(gymSlug)) {
  console.error('Slug must be lowercase letters, numbers and hyphens (3–40 chars).');
  process.exit(1);
}
if (password.length < 6) {
  // Supabase itself rejects anything shorter, so failing here gives a better
  // message than a 422 from GoTrue.
  console.error('Supabase requires a password of at least 6 characters.');
  process.exit(1);
}

const env = loadEnv();
const local = isLocal(env.url);

if (!local && !values['yes-this-is-a-demo-gym']) {
  console.error(`
Refusing to seed a demo owner on ${env.url}.

That is not a local Supabase stack, and this script creates an account with a
weak, publicly-known password. If this project really is the throwaway one you
are demoing from, say so explicitly:

  node scripts/seed-demo-owner.mjs --yes-this-is-a-demo-gym
`);
  process.exit(1);
}

const db = createClient(env);

try {
  // ---- gym ---------------------------------------------------------------
  const existingGyms = await db.rest(`gyms?slug=eq.${encodeURIComponent(gymSlug)}&select=id,name`);
  let gym = existingGyms[0];

  if (gym) {
    // The real guard. Once members exist the database holds phone numbers and
    // payment history, and a known password on an OWNER account is no longer a
    // demo convenience — it is the way in.
    const members = await db.rest(`gym_members?gym_id=eq.${gym.id}&select=id&limit=1`);
    if (members.length > 0 && !local) {
      console.error(`
Refusing: gym "${gym.name}" already has members.

This script would put a weak, publicly-known password on an OWNER account that
can read every one of their phone numbers. Create the account properly instead:

  node scripts/bootstrap-gym.mjs
`);
      process.exit(1);
    }
    console.log(`· gym "${gym.name}" already exists — reusing it`);
  } else {
    [gym] = await db.rest('gyms', {
      method: 'POST',
      body: JSON.stringify({
        slug: gymSlug,
        name: gymName,
        // CLAUDE.md rule 7 — stored once here, and every timestamp elsewhere
        // stays UTC and is rendered through this.
        timezone: 'Asia/Kolkata',
      }),
    });
    console.log(`✓ created gym "${gym.name}"`);
  }

  // ---- opening hours -----------------------------------------------------
  // Sunday closed, weekdays 06:00–22:00, Saturday 07:00–21:00. Real enough that
  // the OPEN/CLOSED badge on the member home screen means something during a
  // demo, and the owner edits them in Settings.
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
    console.log('✓ set default opening hours');
  } else {
    console.log('· opening hours already set — left alone');
  }

  // ---- plans -------------------------------------------------------------
  // Without at least one plan the member app has nothing to sell and the join
  // flow dead-ends at an empty screen, which is the worst thing to discover
  // while someone is watching. Prices are paise (CLAUDE.md rule 5).
  const existingPlans = await db.rest(`membership_plans?gym_id=eq.${gym.id}&select=id&limit=1`);
  if (existingPlans.length === 0) {
    await db.rest('membership_plans', {
      method: 'POST',
      body: JSON.stringify([
        {
          gym_id: gym.id,
          name: 'Monthly',
          description: 'One month of full access.',
          price_paise: 150_000,
          duration_days: 30,
          sort_order: 1,
        },
        {
          gym_id: gym.id,
          name: 'Quarterly',
          description: 'Three months, at a better rate.',
          price_paise: 400_000,
          duration_days: 90,
          sort_order: 2,
        },
        {
          gym_id: gym.id,
          name: 'Annual',
          description: 'Twelve months, the best rate.',
          price_paise: 1_400_000,
          duration_days: 365,
          sort_order: 3,
        },
      ]),
    });
    console.log('✓ created 3 membership plans');
  } else {
    console.log('· plans already exist — left alone');
  }

  // ---- owner account -----------------------------------------------------
  const owner = await ensureAuthUser(db, { email: ownerEmail, password, name: values.name });

  if (owner.created) {
    console.log('✓ created the owner account');
  } else {
    // Re-running should leave a known-good credential, otherwise a second run
    // "succeeds" and the password on the card no longer works.
    await db.admin(`admin/users/${owner.id}`, {
      method: 'PUT',
      body: JSON.stringify({ password, email_confirm: true }),
    });
    console.log('· owner account already existed — password reset to the one below');
  }

  const staff = await ensureStaff(db, {
    gymId: gym.id,
    userId: owner.id,
    name: values.name,
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
    // Never the password. An audit row is read by more people than a console is.
    metadata: { slug: gymSlug, owner_email: ownerEmail, seeded_by: 'seed-demo-owner' },
  });

  console.log(`
Done — ${env.url}

  Admin sign in
    Username   ${username}
    Password   ${password}

  Member app
    Gym code   ${gymSlug}        (what the join QR encodes)

  The admin console must be built with
    NEXT_PUBLIC_ADMIN_USERNAME_DOMAIN=${values.domain}
  or "${username}" will resolve to an address that does not exist.

  Before a single real member joins: change this password in the Supabase
  dashboard, or re-run bootstrap-gym.mjs and delete this account.
`);
} catch (error) {
  console.error('\nSeeding failed:', error.message);
  process.exit(1);
}
