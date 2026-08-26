import { defineConfig } from 'vitest/config';

/**
 * The integration suite talks to the local Supabase stack, so it is deliberately
 * separate from the unit suites: it is slower, it needs Docker, and every file
 * shares one database.
 *
 * `fileParallelism: false` is the part that matters. `singleFork` alone only
 * means one process — vitest still interleaves test files inside it, and these
 * files clear shared tables (rate_limits, pending memberships) in their arrange
 * steps. Interleaved, they wipe those tables out from under each other, which
 * shows up as a limit that mysteriously does not fire and a pending membership
 * that mysteriously exists. Both look like product bugs and are not.
 */
export default defineConfig({
  test: {
    include: ['supabase/tests/integration/**/*.test.ts'],
    globalSetup: ['supabase/tests/integration/global-setup.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
