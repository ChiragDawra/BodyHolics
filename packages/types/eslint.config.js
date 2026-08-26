import base from '@gym/config/eslint/base';

export default [
  ...base,
  {
    // database.ts is written by `supabase gen types` and is never hand-edited.
    ignores: ['src/database.ts'],
  },
];
