import {
  dxCodeStyle,
  dxIgnore,
  fwReact,
  langJavascript,
  langTypescript,
  novaRules,
  runtimeBrowser,
  toolVite,
} from '@cbnventures/nova/presets/eslint';

/**
 * ESLint Configuration.
 *
 * Composes Nova's browser, React, Vite, and TypeScript contracts for the interface.
 *
 * @since 0.0.0
 */
export default [
  ...dxIgnore,
  ...dxCodeStyle,
  ...langJavascript,
  ...langTypescript,
  ...fwReact,
  ...runtimeBrowser,
  ...toolVite,
  {
    name: 'custom-tsconfig',
    files: [
      '**/*.cts',
      '**/*.mts',
      '**/*.ts',
      '**/*.tsx',
    ],
    languageOptions: {
      parserOptions: {
        project: [
          './tsconfig.config.json',
          './tsconfig.tests.json',
          './tsconfig.web.json',
        ],
      },
    },
  },
  ...novaRules,
  {
    name: 'custom-nova-rules',
    files: [
      '**/*.cjs',
      '**/*.cts',
      '**/*.js',
      '**/*.jsx',
      '**/*.mjs',
      '**/*.mts',
      '**/*.ts',
      '**/*.tsx',
    ],
    rules: {
      '@cbnventures/nova/require-kebab-case-filename': [
        'error',
        {
          extraExtensions: [],
          ignoreFiles: [
            './eslint.config.mts',
            './vite.config.mts',
            './vitest.config.mts',
          ],
        },
      ],
    },
  },
  {
    // The console shares its React files with the other appliances, written in that interface's style.
    // Its tests exercise those same modules, so they follow the same style.
    name: 'console-interface',
    files: [
      'mock-api.mts',
      'src/types/web/**/*.d.ts',
      'src/web/**/*.ts',
      'src/web/**/*.tsx',
      'tests/**/*.test.ts',
    ],
    rules: {
      '@cbnventures/nova/no-bracket-assignment': 'off',
      '@cbnventures/nova/no-complex-arrow-concise': 'off',
      '@cbnventures/nova/no-destructuring': 'off',
      '@cbnventures/nova/no-implicit-boolean': 'off',
      '@cbnventures/nova/no-inline-type-annotation': 'off',
      '@cbnventures/nova/no-multiline-strings': 'off',
      '@cbnventures/nova/no-optional-chaining': 'off',
      '@cbnventures/nova/no-regex-literal-flags': 'off',
      '@cbnventures/nova/no-regex-literals': 'off',
      '@cbnventures/nova/no-ternary-in-template-literal': 'off',
      '@cbnventures/nova/no-use-before-define': 'off',
      '@cbnventures/nova/require-bracket-property-access': 'off',
      '@cbnventures/nova/require-explicit-return': 'off',
      '@cbnventures/nova/require-jsdoc-hierarchy': 'off',
      '@cbnventures/nova/require-jsdoc-returns': 'off',
      '@cbnventures/nova/require-multiline-condition-groups': 'off',
      '@cbnventures/nova/require-multiline-conditions': 'off',
      '@cbnventures/nova/require-padding-lines': 'off',
      'n/no-unsupported-features/node-builtins': 'off',
    },
  },
];
