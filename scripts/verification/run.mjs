import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verificationEnvironment } from './environment.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const [command, ...args] = process.argv.slice(2);
const webRequire = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const sharedRequire = createRequire(new URL('../../packages/shared/package.json', import.meta.url));
const commands = {
  web: [
    join(dirname(webRequire.resolve('vitest/package.json')), 'vitest.mjs'),
    'run',
    '--config',
    'vitest.config.ts',
    '--root',
    'apps/web',
  ],
  shared: [
    join(dirname(sharedRequire.resolve('vitest/package.json')), 'vitest.mjs'),
    'run',
    '--config',
    'vitest.config.ts',
    '--root',
    'packages/shared',
  ],
  build: ['node_modules/next/dist/bin/next', 'build', 'apps/web'],
};
if (!commands[command]) throw new Error(`Unknown verification command: ${command}`);
if (command === 'build') {
  for (const name of ['.env', '.env.local', '.env.production', '.env.production.local']) {
    if (existsSync(join(root, 'apps/web', name)))
      throw new Error(
        `Verification refuses app-local ${name}; keep development credentials in the root .env`,
      );
  }
}
const result = spawnSync(process.execPath, [...commands[command], ...args], {
  cwd: root,
  env: {
    ...verificationEnvironment(),
    ...(command === 'build' ? { WEATHERB_VERIFY_BUILD: '1' } : {}),
  },
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
