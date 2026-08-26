// docs/06 §3 — layering rules. Documented-but-unenforced rules get broken within
// two weeks, so every row of that table is a lint error here.
import boundaries from 'eslint-plugin-boundaries';

/**
 * @param {{ root?: string }} [options]
 */
export function boundariesConfig(options = {}) {
  const root = options.root ?? '.';
  return [
    {
      plugins: { boundaries },
      settings: {
        'boundaries/include': ['app/**', 'src/**'],
        'boundaries/elements': [
          { type: 'route', pattern: 'app/**' },
          { type: 'feature-components', pattern: 'src/features/*/components/**', capture: ['feature'] },
          { type: 'feature-hooks', pattern: 'src/features/*/hooks.ts', capture: ['feature'] },
          { type: 'feature-api', pattern: 'src/features/*/api.ts', capture: ['feature'] },
          { type: 'feature-schemas', pattern: 'src/features/*/schemas.ts', capture: ['feature'] },
          { type: 'feature-types', pattern: 'src/features/*/types.ts', capture: ['feature'] },
          { type: 'shared-components', pattern: 'src/components/**' },
          { type: 'lib', pattern: 'src/lib/**' },
          { type: 'providers', pattern: 'src/providers/**' },
          { type: 'theme', pattern: 'src/theme/**' },
        ],
      },
      rules: {
        'boundaries/no-unknown-files': 'off',
        'boundaries/element-types': [
          'error',
          {
            default: 'disallow',
            rules: [
              {
                from: 'route',
                allow: [
                  'feature-components',
                  'feature-hooks',
                  'feature-types',
                  'shared-components',
                  'providers',
                  'theme',
                ],
              },
              // Presentational only: props in, JSX out. No data access.
              { from: 'feature-components', allow: ['shared-components', 'feature-types', 'theme'] },
              { from: 'feature-hooks', allow: ['feature-api', 'feature-schemas', 'feature-types'] },
              { from: 'feature-api', allow: ['lib', 'feature-schemas', 'feature-types'] },
              { from: 'shared-components', allow: ['shared-components', 'theme'] },
              { from: 'providers', allow: ['lib', 'theme', 'feature-hooks'] },
              { from: 'lib', allow: ['lib'] },
              { from: ['feature-schemas', 'feature-types', 'theme'], allow: ['theme'] },
            ],
          },
        ],
      },
    },
    {
      // A screen must never hold a Supabase client (docs/06 §3, CLAUDE.md §5).
      files: [`${root}/app/**/*.{ts,tsx}`, `${root}/src/features/*/components/**/*.{ts,tsx}`],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: '@supabase/supabase-js',
                message: 'Data access belongs in features/*/api.ts, never in a screen or component.',
              },
              {
                name: '@supabase/ssr',
                message: 'Data access belongs in features/*/api.ts, never in a screen or component.',
              },
            ],
          },
        ],
      },
    },
    {
      // packages/domain is pure: zod + date-fns only, no React, no I/O.
      files: ['**/packages/domain/src/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              { group: ['react', 'react-*', '@supabase/*', 'next/*', 'expo*', '@tanstack/*'], message: 'packages/domain is pure — zod and date-fns only (docs/06 §4).' },
              { group: ['node:*', 'fs', 'path', 'crypto'], message: 'packages/domain does no I/O (docs/06 §4).' },
            ],
          },
        ],
      },
    },
  ];
}

export default boundariesConfig;
