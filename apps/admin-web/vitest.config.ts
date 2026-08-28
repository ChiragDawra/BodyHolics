import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Vitest does not read `paths` out of tsconfig, so the `@/` alias has to be
 * restated here or every import in a test resolves to nothing.
 *
 * The env values are the ones `src/lib/env.ts` validates at module load. They
 * are placeholders, not credentials — the module throws without them, and a test
 * that imports anything reaching it would fail before its first assertion.
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key-not-a-real-credential',
      NEXT_PUBLIC_APP_ENV: 'local',
      NEXT_PUBLIC_ADMIN_USERNAME_DOMAIN: 'staff.bodyholics.app',
    },
  },
});
