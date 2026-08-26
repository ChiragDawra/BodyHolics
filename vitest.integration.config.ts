import { defineConfig } from 'vitest/config';

/**
 * The integration suite talks to the local Supabase stack, so it is deliberately
 * separate from the unit suites: it is slower, it needs Docker, and it shares one
 * database across files. `singleFork` keeps the files from racing each other on
 * that shared state.
 */
export default defineConfig({
  test: {
    include: ['supabase/tests/integration/**/*.test.ts'],
    globalSetup: ['supabase/tests/integration/global-setup.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
