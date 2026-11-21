import { VitestCoverage } from '@cbnventures/nova/toolkit';
import { defineConfig } from 'vitest/config';

/**
 * Vitest Configuration.
 *
 * Discovers workspace-level tests for the container-native project.
 * Keeps image configuration checks isolated from neighboring workspaces.
 *
 * @since 0.0.0
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    passWithNoTests: true,
    coverage: VitestCoverage.options(),
  },
});
