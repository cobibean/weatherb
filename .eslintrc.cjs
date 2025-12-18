/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  ignorePatterns: ['**/dist/**', '**/.next/**', '**/out/**', '**/build/**', '**/coverage/**'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['plugin:@typescript-eslint/recommended', 'prettier'],
  overrides: [
    {
      files: ['apps/web/**/*.{ts,tsx,js,jsx,cjs,mjs}'],
      extends: ['next/core-web-vitals'],
    },
    {
      files: ['**/*.ts', '**/*.tsx'],
      rules: {
        '@typescript-eslint/explicit-module-boundary-types': 'error',
      },
    },
    {
      files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
      parser: 'espree',
    },
  ],
};
