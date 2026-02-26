/**
 * Vitest configuration — extends Vite config for test runner and coverage.
 */

import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      setupFiles: ['src/test-utils/setup.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov', 'html'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          '**/*.d.ts',
          '**/*.test.*',
          '**/*.spec.*',
          'src/main.tsx',
          'src/test-utils/**',
        ],
        // Target 90%+ as tests are added. Set to 0 so CI does not fail until coverage is raised.
        thresholds: {
          lines: 0,
          functions: 0,
          branches: 0,
          statements: 0,
        },
      },
    },
  }),
);
