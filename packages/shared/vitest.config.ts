import { defineConfig } from 'vitest/config';
import { verificationEnvironment } from '../../scripts/verification/environment.mjs';

const safeEnvironment = verificationEnvironment();
for (const key of Object.keys(process.env)) delete process.env[key];
Object.assign(process.env, safeEnvironment);

export default defineConfig({
  envDir: false,
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/__tests__/**', 'src/types/**'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
