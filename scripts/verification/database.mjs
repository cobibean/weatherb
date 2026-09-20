import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { mkdtempSync, writeFileSync, rmSync, realpathSync, existsSync } from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { verificationEnvironment } from './environment.mjs';
import { assertDisposableDatabase } from './test-database.mjs';

if (
  process.env.TEST_DATABASE_URL ||
  process.env.WEATHERB_TEST_SOCKET ||
  process.env.WEATHERB_TEST_TOKEN
) {
  throw new Error('External test targets are not accepted; this command creates its own database');
}
const webRequire = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const root = fileURLToPath(new URL('../../', import.meta.url));
const pgBin =
  process.env.WEATHERB_PG_BIN ||
  (existsSync('/opt/homebrew/opt/postgresql@14/bin/initdb')
    ? '/opt/homebrew/opt/postgresql@14/bin'
    : '/usr/lib/postgresql/16/bin');
const dir = realpathSync(mkdtempSync(join(tmpdir(), 'weatherb-test-')));
const env = verificationEnvironment();
const url = new URL('postgresql://localhost/weatherb_test');
url.username = userInfo().username;
url.searchParams.set('host', dir);
Object.assign(env, {
  DATABASE_URL: url.href,
  DIRECT_URL: url.href,
  WEATHERB_TEST_SOCKET: dir,
  WEATHERB_TEST_TOKEN: randomUUID(),
});
writeFileSync(
  join(dir, 'owner.json'),
  JSON.stringify({ token: env.WEATHERB_TEST_TOKEN, url: url.href }),
  { mode: 0o600 },
);
function run(command, args, cwd = root, childEnv = env) {
  const result = spawnSync(command, args, { cwd, env: childEnv, stdio: 'inherit' });
  if (process.argv.includes('--serve') && (result.signal === 'SIGINT' || result.status === 130))
    return;
  if (result.error || result.status !== 0)
    throw new Error(`${command} failed (${result.status})`, { cause: result.error });
}
let started = false;
try {
  assertDisposableDatabase(env);
  run(join(pgBin, 'initdb'), ['-D', join(dir, 'data'), '-A', 'trust', '--no-locale', '-E', 'UTF8']);
  run(join(pgBin, 'pg_ctl'), [
    '-D',
    join(dir, 'data'),
    '-l',
    join(dir, 'postgres.log'),
    '-o',
    `-k ${dir} -h ''`,
    '-w',
    'start',
  ]);
  started = true;
  run(join(pgBin, 'createdb'), ['-h', dir, 'weatherb_test']);
  run(join(pgBin, 'psql'), [
    '-h',
    dir,
    '-d',
    'weatherb_test',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    "ALTER DATABASE weatherb_test SET TimeZone = 'UTC'",
  ]);
  run(join(pgBin, 'psql'), [
    '-h',
    dir,
    '-d',
    'weatherb_test',
    '-v',
    'ON_ERROR_STOP=1',
    '-f',
    join(root, 'scripts/development/bootstrap-roles.sql'),
  ]);
  run(join(pgBin, 'psql'), [
    '-h',
    dir,
    '-d',
    'weatherb_test',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    'ALTER ROLE weatherb_migrator LOGIN',
  ]);
  assertDisposableDatabase(env);
  const migrationUrl = new URL(url.href);
  migrationUrl.username = 'weatherb_migrator';
  run(
    process.execPath,
    [join(root, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
    join(root, 'apps/web'),
    { ...env, DIRECT_URL: migrationUrl.href },
  );
  run(join(pgBin, 'psql'), [
    '-h',
    dir,
    '-U',
    'weatherb_migrator',
    '-d',
    'weatherb_test',
    '-v',
    'ON_ERROR_STOP=1',
    '-f',
    join(root, 'scripts/development/access.sql'),
  ]);
  if (process.argv.includes('--serve')) {
    run(
      process.execPath,
      [join(root, 'node_modules/tsx/dist/cli.mjs'), 'src/scripts/development-database.ts', 'seed'],
      join(root, 'apps/web'),
    );
    // Keep the parent alive long enough to clean the database on Ctrl-C.
    process.on('SIGINT', () => {});
    process.on('SIGTERM', () => {});
    run(process.execPath, [
      join(root, 'node_modules/next/dist/bin/next'),
      'start',
      'apps/web',
      '--hostname',
      '127.0.0.1',
      '--port',
      '3011',
    ]);
  } else
    run(
      process.execPath,
      [
        join(dirname(webRequire.resolve('vitest/package.json')), 'vitest.mjs'),
        'run',
        '--config',
        'vitest.database.config.ts',
      ],
      join(root, 'apps/web'),
    );
} finally {
  if (started) {
    const stopped = spawnSync(
      join(pgBin, 'pg_ctl'),
      ['-D', join(dir, 'data'), '-m', 'immediate', '-w', 'stop'],
      { env, stdio: 'inherit' },
    );
    if (stopped.status !== 0)
      throw new Error(`Database could not stop; retained ${dir} for recovery`);
  }
  rmSync(dir, { recursive: true, force: true });
}
