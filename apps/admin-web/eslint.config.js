import base from '@gym/config/eslint/base';
import { boundariesConfig } from '@gym/config/eslint/boundaries';
import { reactConfig } from '@gym/config/eslint/react';

export default [
  { ignores: ['.next/**', 'next-env.d.ts'] },
  ...base,
  ...boundariesConfig(),
  ...reactConfig(),
];
