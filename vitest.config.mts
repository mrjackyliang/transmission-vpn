import { defineConfig } from 'vitest/config';

/**
 * Vitest Configuration.
 *
 * Keeps root tests separate from the test suites owned by workspaces.
 * Workspace checks run through their own package scripts and configurations.
 *
 * @since 0.0.0
 */
export default defineConfig({
  test: {
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    exclude: [
      'apps/**',
      'packages/**',
      '**/node_modules/**',
    ],
  },
});
