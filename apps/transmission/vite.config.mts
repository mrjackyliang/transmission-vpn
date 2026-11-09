import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { mockApi } from './mock-api.mjs';

/**
 * Vite Configuration.
 *
 * Builds the first-party interface for the Go control server, proxies development
 * traffic to the appliance or answers it from the mock API, and skips .env files
 * so their NODE_ENV can't turn a build into a development build.
 *
 * @since 0.0.1
 */
export default defineConfig(({ mode }) => ({
  appType: 'spa',
  build: {
    outDir: 'build',
    rolldownOptions: {
      output: {
        // Libraries ship as their own files so no single bundle passes 500 kB.
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: '/node_modules/react',
            },
            {
              name: 'vendor',
              test: '/node_modules/',
            },
          ],
        },
      },
    },
  },
  envDir: false,
  plugins: (mode === 'mock') ? [
    react(),
    mockApi(),
  ] : [react()],
  publicDir: 'src/web/public',
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  server: {
    port: 5173,
    proxy: (mode === 'mock') ? {} : {
      '/api': 'http://127.0.0.1:22602',
      '/transmission/rpc': 'http://127.0.0.1:9091',
    },
  },
}));
