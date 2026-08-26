import { defineConfig } from 'vitest/config';

// Every Edge Function body passes through these schemas, so an untested branch
// here is an unguarded request path. Same 100% bar as packages/domain.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
