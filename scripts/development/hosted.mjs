import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parse } from 'dotenv';
import { hostedEnvironment } from './hosted-profile.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const commands = {
  migrate: ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
  seed: ['node_modules/tsx/dist/cli.mjs', 'src/scripts/development-database.ts', 'seed'],
  check: ['node_modules/tsx/dist/cli.mjs', 'src/scripts/development-database.ts', 'check'],
  reconcile: ['node_modules/tsx/dist/cli.mjs', 'src/scripts/arc-hosted-reconcile.ts'],
  settler: ['node_modules/tsx/dist/cli.mjs', 'src/scripts/development-database.ts', 'settler', ...process.argv.slice(3)],
  scheduler: ['node_modules/tsx/dist/cli.mjs', 'src/scripts/development-database.ts', 'scheduler', ...process.argv.slice(3)],
  'mark-test': ['node_modules/tsx/dist/cli.mjs', 'src/scripts/development-database.ts', 'mark-test', ...process.argv.slice(3)],
};
const command = process.argv[2];
if (!Object.hasOwn(commands, command)) throw new Error('Use migrate, seed, check, reconcile, settler, scheduler, or mark-test');
const profile = `${root}.env.arc-hosted`;
if (statSync(profile).mode & 0o077) throw new Error('Hosted profile must have mode 0600');
const settings = hostedEnvironment(parse(readFileSync(profile)));
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) =>
    ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot'].includes(key),
  ),
);
Object.assign(env, settings);
if (command !== 'migrate') delete env.DIRECT_URL;
function run([script, ...args], childEnv = env) {
  const result = spawnSync(process.execPath, [`${root}${script}`, ...args], {
    cwd: `${root}apps/web`,
    env: childEnv,
    stdio: 'inherit',
  });
  if (result.error) throw new Error('Hosted command could not start');
  return result.status ?? 1;
}
process.exitCode = run(commands[command]);
if (command === 'migrate' && process.exitCode === 0) {
  process.exitCode = run(
    ['node_modules/tsx/dist/cli.mjs', 'src/scripts/development-database.ts', 'access'],
    { ...env, DATABASE_URL: settings.DIRECT_URL },
  );
}
