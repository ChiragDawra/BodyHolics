/**
 * Read-only: report which tables the hosted project has and how many rows are
 * in each, so a deploy can tell "migrations not applied yet" apart from
 * "applied, and there is already real data here".
 *
 * Prints no key material. Makes no writes.
 *
 * Usage: node scripts/probe-hosted.mjs
 */
import { loadEnv, isLocal } from './lib/supabase-admin.mjs';

// loadEnv() exits with instructions if supabase/.env.production is missing, and
// returns the values rather than the raw env names — the forbidden identifier
// stays confined to that one module (CLAUDE.md rule 3).
const { url, serviceKey } = loadEnv();

console.log('project host:', new URL(url).host, isLocal(url) ? '(local)' : '(hosted)');

const TABLES = [
  'gyms',
  'profiles',
  'gym_staff',
  'membership_plans',
  'memberships',
  'payments',
  'attendance_events',
  'audit_logs',
];

for (const table of TABLES) {
  const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      // `count=exact` puts the row count in Content-Range without returning rows,
      // so this never pulls a member's phone number onto the operator's terminal.
      Prefer: 'count=exact',
      Range: '0-0',
    },
  });

  const range = response.headers.get('content-range') ?? '';
  const count = range.includes('/') ? range.split('/')[1] : '?';

  if (response.ok) {
    console.log(`  ${table.padEnd(20)} OK    rows=${count}`);
  } else {
    // A 404 here means the table is absent, which is how "migrations have not
    // been applied" shows up. Truncated because PostgREST errors are verbose.
    const body = await response.text();
    console.log(
      `  ${table.padEnd(20)} ${response.status}   ${body.slice(0, 110).replace(/\s+/g, ' ')}`,
    );
  }
}
