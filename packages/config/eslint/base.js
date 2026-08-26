// Shared flat-config base. Apps extend this and add their own framework plugin.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/** Identifiers that must never appear outside `supabase/functions/`. */
export const SERVER_ONLY_IDENTIFIERS = [
  'createAdminClient',
  'SUPABASE_SERVICE_ROLE_KEY',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
];

export const ignores = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.next/**',
  '**/.expo/**',
  '**/.turbo/**',
  '**/coverage/**',
  '**/*.generated.ts',
  '**/database.ts',
];

export default tseslint.config(
  { ignores },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true },
    },
    rules: {
      // docs/03 §8 — no `any`. An unavoidable one needs an inline disable + reason.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // CLAUDE.md hard rule 3 — the service key never exists in an app bundle.
      'no-restricted-globals': [
        'error',
        {
          name: 'SUPABASE_SERVICE_ROLE_KEY',
          message: 'Service-role credentials are Edge-Function-only (CLAUDE.md rule 3).',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: `Identifier[name=/^(${SERVER_ONLY_IDENTIFIERS.join('|')})$/]`,
          message:
            'Server-only identifier. Allowed only under supabase/functions/ (CLAUDE.md rule 3).',
        },
        {
          selector:
            'MemberExpression[object.type="MemberExpression"][object.property.name="env"][property.name=/SERVICE_ROLE|KEY_SECRET|WEBHOOK_SECRET/]',
          message: 'Reading a server-only secret from a client bundle (CLAUDE.md rule 3).',
        },
      ],
    },
  },
  {
    // Money is integer paise. Float maths on a *_paise value is a correctness bug.
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'round', message: 'Money is integer paise — no rounding. Use packages/domain/money.ts.' },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/tests/**'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      'no-restricted-syntax': 'off',
    },
  },
);
