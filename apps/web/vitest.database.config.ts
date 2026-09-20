import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { assertDisposableDatabase } from '../../scripts/verification/test-database.mjs';

assertDisposableDatabase();

export default defineConfig({
  envDir: false,
  test: {
    environment: 'node',
    include: ['src/**/*.db.test.ts'],
    setupFiles: ['./src/test/database-setup.ts'],
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@weatherb/shared': path.resolve(import.meta.dirname, '../../packages/shared/src'),
    },
  },
});
