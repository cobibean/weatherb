import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import nextVitals from 'eslint-config-next/core-web-vitals';
import prettier from 'eslint-config-prettier/flat';
import { fileURLToPath } from 'node:url';

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/.next/**',
    '**/out/**',
    '**/build/**',
    '**/coverage/**',
    '.tools/**',
    'contracts/lib/**',
  ]),
  tseslint.configs.recommended,
  {
    files: ['apps/web/**/*.{ts,tsx,js,jsx,cjs,mjs}'],
    extends: nextVitals,
    settings: { next: { rootDir: fileURLToPath(new URL('./apps/web/', import.meta.url)) } },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      'no-restricted-imports': ['error', { patterns: [{
        group: ['**/deferred/**', '@weatherb/market-bot', '@weatherb/market-bot/*'],
        message: 'Deferred features must remain outside the active verification boundary.',
      }] }],
    },
  },
  prettier,
]);
