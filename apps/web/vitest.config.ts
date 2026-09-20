import { defineConfig } from 'vitest/config';
import path from 'path';
import { verificationEnvironment } from '../../scripts/verification/environment.mjs';

// Also protect direct Vitest invocation, before importing any test module.
const safeEnvironment = verificationEnvironment();
for (const key of Object.keys(process.env)) delete process.env[key];
Object.assign(process.env, safeEnvironment);

export default defineConfig({
  envDir: false,
  // Next preserves JSX for its bundler; Vitest/Vite must transform it for Node.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['src/**/*.db.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/__tests__/**',
        'src/types/**',
        'src/app/**', // Next.js app routes tested via integration tests
      ],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 70,
        statements: 75,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@weatherb/shared': path.resolve(import.meta.dirname, '../../packages/shared/src'),
    },
  },
});
