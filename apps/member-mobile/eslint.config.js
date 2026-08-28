import base from '@gym/config/eslint/base';
import { boundariesConfig } from '@gym/config/eslint/boundaries';
import { reactConfig } from '@gym/config/eslint/react';

export default [
  // `public/` is copied verbatim into the web export. The service worker there
  // runs in a worker global with no TypeScript project behind it, so the typed
  // linter can only fail on it.
  { ignores: ['.expo/**', 'dist/**', 'public/**', 'expo-env.d.ts'] },
  ...base,
  ...boundariesConfig(),
  ...reactConfig(),
];
