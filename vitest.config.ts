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
          'src/types/**',
          'src/api/models.ts',
          'src/pwa.ts',
        ],
        // Target 90%+ as more tests are added. Current baseline ~41%; thresholds prevent regression.
        thresholds: {
          lines: 40,
          functions: 40,
          branches: 65,
          statements: 40,
        },
      },
    },
  }),
);
