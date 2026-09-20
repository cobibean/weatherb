import { existsSync, mkdirSync, readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

const root = realpathSync(fileURLToPath(new URL('../../', import.meta.url)));
const dir = join(root, '.tools/arc-postgres');
const pgBin =
  process.env.WEATHERB_PG_BIN ||
  (existsSync('/opt/homebrew/opt/postgresql@14/bin/initdb')
    ? '/opt/homebrew/opt/postgresql@14/bin'
    : '/usr/lib/postgresql/16/bin');
const marker = join(dir, 'owner.json');
const profile = join(root, '.env.arc-dev');
const action = process.argv[2] ?? 'start';
if (!['start', 'stop'].includes(action)) throw new Error('Use start or stop');
if (action === 'stop' && !existsSync(marker)) {
  console.log('No local development database registered.');
  process.exit(0);
}
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) =>
    ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP'].includes(key),
  ),
);
function run(command, args, extraEnv = {}, input) {
  const result = spawnSync(command, args, {
    env: { ...env, ...extraEnv },
    input,
    encoding: 'utf8',
  });
  // Commands may receive generated role passwords on stdin: never echo SQL or raw errors.
  if (result.status !== 0)
    throw new Error(`Local database setup failed at ${command.split('/').at(-1)}`);
}
if (!existsSync(marker)) {
  if (existsSync(dir) || existsSync(profile))
    throw new Error(
      'Existing local database/profile found without ownership marker; inspect before setup',
    );
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(
    marker,
    JSON.stringify({
      project: 'weatherb-arc-dev',
      root,
      port: 55439,
      database: 'weatherb_arc_dev',
      initialized: false,
    }),
    { mode: 0o600 },
  );
  writeFileSync(join(dir, 'admin-password'), randomBytes(32).toString('hex'), { mode: 0o600 });
}
const owner = JSON.parse(readFileSync(marker, 'utf8'));
if (
  owner.root !== root ||
  owner.project !== 'weatherb-arc-dev' ||
  owner.port !== 55439 ||
  owner.database !== 'weatherb_arc_dev'
)
  throw new Error('Local database ownership mismatch');
if (action === 'stop') {
  const running = spawnSync(join(pgBin, 'pg_ctl'), ['-D', join(dir, 'data'), 'status'], {
    env,
    stdio: 'ignore',
  });
  if (running.status === 0)
    run(join(pgBin, 'pg_ctl'), ['-D', join(dir, 'data'), '-m', 'fast', '-w', 'stop']);
  console.log('Local development database stopped; data and credentials preserved.');
  process.exit(0);
}
const adminPassword = readFileSync(join(dir, 'admin-password'), 'utf8');
if (!existsSync(join(dir, 'data/PG_VERSION'))) {
  run(join(pgBin, 'initdb'), [
    '-D',
    join(dir, 'data'),
    '-U',
    'weatherb_local_admin',
    '-A',
    'scram-sha-256',
    '--pwfile',
    join(dir, 'admin-password'),
    '--no-locale',
    '-E',
    'UTF8',
  ]);
}
const running = spawnSync(join(pgBin, 'pg_ctl'), ['-D', join(dir, 'data'), 'status'], {
  env,
  stdio: 'ignore',
});
if (running.status !== 0)
  run(join(pgBin, 'pg_ctl'), [
    '-D',
    join(dir, 'data'),
    '-l',
    join(dir, 'postgres.log'),
    '-o',
    `-k ${dir} -h '' -p 55439`,
    '-w',
    'start',
  ]);
const args = ['-h', dir, '-p', '55439', '-U', 'weatherb_local_admin'];
if (!owner.initialized) {
  if (existsSync(profile))
    throw new Error(
      'Incomplete setup found with an existing profile; inspect rather than replace credentials',
    );
  // The ownership marker permits resuming an interrupted fresh setup.
  const probe = spawnSync(
    join(pgBin, 'psql'),
    [
      ...args,
      '-d',
      'postgres',
      '-Atc',
      "SELECT 1 FROM pg_database WHERE datname='weatherb_arc_dev'",
    ],
    { env: { ...env, PGPASSWORD: adminPassword }, encoding: 'utf8' },
  );
  if (probe.status !== 0) throw new Error('Local database inspection failed');
  if (probe.stdout.trim() !== '1')
    run(join(pgBin, 'createdb'), [...args, 'weatherb_arc_dev'], { PGPASSWORD: adminPassword });
  const appPassword = randomBytes(32).toString('hex');
  const migrationPassword = randomBytes(32).toString('hex');
  const sql =
    readFileSync(join(root, 'scripts/development/bootstrap-roles.sql'), 'utf8') +
    `\nALTER ROLE weatherb_app LOGIN PASSWORD '${appPassword}';\nALTER ROLE weatherb_migrator LOGIN PASSWORD '${migrationPassword}';\n`;
  run(
    join(pgBin, 'psql'),
    [...args, '-d', 'weatherb_arc_dev', '-v', 'ON_ERROR_STOP=1', '-q'],
    { PGPASSWORD: adminPassword },
    sql,
  );
  function url(role, password) {
    const value = new URL(`postgresql://${role}:${password}@localhost:55439/weatherb_arc_dev`);
    value.searchParams.set('host', dir);
    value.searchParams.set('port', '55439');
    return value.href;
  }
  writeFileSync(
    profile,
    `# Local Arc development only; no legacy service credentials.\nWEATHERB_DATABASE_TARGET=local\nDATABASE_URL=${url('weatherb_app', appPassword)}\nDIRECT_URL=${url('weatherb_migrator', migrationPassword)}\n`,
    { mode: 0o600, flag: 'wx' },
  );
  writeFileSync(marker, JSON.stringify({ ...owner, initialized: true }), { mode: 0o600 });
}
run(
  join(pgBin, 'psql'),
  [
    ...args,
    '-d',
    'weatherb_arc_dev',
    '-v',
    'ON_ERROR_STOP=1',
    '-q',
    '-f',
    join(root, 'scripts/development/bootstrap-roles.sql'),
  ],
  { PGPASSWORD: adminPassword },
);
if (!existsSync(profile)) throw new Error('Local profile is missing; restore it before continuing');
console.log(
  'Local development database is running on a private Unix socket. Run npm run arc:migrate, then npm run arc:seed.',
);
