import { execFileSync } from 'node:child_process';

/**
 * Reset the database before the suite.
 *
 * These tests share one database and several of them arrange state directly, so
 * without this they pass or fail depending on what ran before — which is exactly
 * how a real failure gets dismissed as flakiness. A reset is slow; a suite you
 * cannot trust is slower.
 */
export default function globalSetup() {
  process.stdout.write('resetting the local database before the integration suite…\n');
  execFileSync('pnpm', ['exec', 'supabase', 'db', 'reset'], { stdio: 'ignore' });
}
