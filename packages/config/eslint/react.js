// React-specific rules, for the two apps. Kept out of the base so that
// packages/domain and packages/validation — which must not import React at all —
// do not carry a React plugin.
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * The rules of hooks are not style. A conditional hook or a missing dependency
 * produces a component that works until it doesn't, and the failure shows up as
 * stale data on someone's screen rather than as an error.
 */
export function reactConfig() {
  return [
    {
      files: ['**/*.{ts,tsx}'],
      plugins: { 'react-hooks': reactHooks },
      rules: {
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn',
      },
    },
  ];
}

export default reactConfig;
