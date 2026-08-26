import { defineConfig } from 'vitest/config';

// docs/06 §9 — coverage target for packages/domain is 100%. This is where
// correctness is cheapest to verify, so the threshold is not negotiable.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts', 'src/types.ts'],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
