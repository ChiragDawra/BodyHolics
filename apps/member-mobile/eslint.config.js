import base from '@gym/config/eslint/base';
import { boundariesConfig } from '@gym/config/eslint/boundaries';
import { reactConfig } from '@gym/config/eslint/react';

export default [
  { ignores: ['.expo/**', 'expo-env.d.ts'] },
  ...base,
  ...boundariesConfig(),
  ...reactConfig(),
];
