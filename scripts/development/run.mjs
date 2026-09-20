import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parse } from 'dotenv';

const root = fileURLToPath(new URL('../../', import.meta.url));
const commands = {
  migrate: ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
  seed: ['node_modules/tsx/dist/cli.mjs', 'src/scripts/development-database.ts', 'seed'],
  check: ['node_modules/tsx/dist/cli.mjs', 'src/scripts/development-database.ts', 'check'],
  lifecycle: [
    'node_modules/tsx/dist/cli.mjs',
    'src/scripts/arc-lifecycle.ts',
    ...process.argv.slice(3),
  ],
  dev: ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1'],
};
const command = process.argv[2];
if (!Object.hasOwn(commands, command)) throw new Error('Use migrate, seed, check, or dev');
let settings;
try {
  settings = parse(readFileSync(`${root}.env.arc-dev`));
} catch {
  throw new Error(
    'Create .env.arc-dev from .env.arc-dev.example before using development commands',
  );
}
const ref = settings.WEATHERB_SUPABASE_PROJECT_REF;
const local = settings.WEATHERB_DATABASE_TARGET === 'local';
const dir = `${realpathSync(root)}/.tools/arc-postgres`;
if (local) {
  const owner = JSON.parse(readFileSync(`${dir}/owner.json`, 'utf8'));
  if (
    owner.root !== realpathSync(root) ||
    owner.project !== 'weatherb-arc-dev' ||
    !owner.initialized ||
    owner.database !== 'weatherb_arc_dev' ||
    owner.port !== 55439
  )
    throw new Error('Local development database ownership mismatch');
} else if (!ref || !/^[a-z]{20}$/.test(ref) || ref === 'zgyzypyketbzhclzewcs') {
  throw new Error('A new development project reference is required');
}
function validateUrl(raw, role) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Missing or invalid ${role} database URL`);
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.password)
    throw new Error('A PostgreSQL URL with separate development credentials is required');
  if (local) {
    if (
      url.hostname !== 'localhost' ||
      url.port !== '55439' ||
      url.username !== role ||
      url.pathname !== '/weatherb_arc_dev' ||
      url.searchParams.get('host') !== dir ||
      url.searchParams.get('port') !== '55439'
    )
      throw new Error('Expected the owned local development database connection');
  } else {
    const hostMatches =
      url.hostname === `db.${ref}.supabase.co` ||
      (url.hostname.endsWith('.pooler.supabase.com') && url.username === `${role}.${ref}`);
    if (
      !hostMatches ||
      ![role, `${role}.${ref}`].includes(url.username) ||
      url.pathname !== '/postgres' ||
      url.searchParams.get('sslmode') !== 'verify-full'
    )
      throw new Error(
        `Expected the new development project's ${role} connection with verified TLS`,
      );
  }
  return url.href;
}
const databaseUrl = validateUrl(settings.DATABASE_URL, 'weatherb_app');
const migrationUrl = validateUrl(settings.DIRECT_URL, 'weatherb_migrator');
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) =>
    ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot'].includes(key),
  ),
);
// Explicit Arc dev credentials only; do not inherit the shell or legacy env files.
for (const key of [
  'NEXT_PUBLIC_THIRDWEB_CLIENT_ID',
  'NEXT_PUBLIC_CHAIN_ID',
  'NEXT_PUBLIC_CONTRACT_ADDRESS',
  'RPC_URL',
  'TOMORROW_IO_API_KEY',
  'SCHEDULER_PRIVATE_KEY',
  'SETTLER_PRIVATE_KEY',
  'ADMIN_PRIVATE_KEY',
  'CRON_SECRET',
]) {
  if (settings[key]) env[key] = settings[key];
}
Object.assign(env, {
  DATABASE_URL: databaseUrl,
  WEATHERB_ENV_FILE: 'none',
  NEXT_TELEMETRY_DISABLED: '1',
});
if (command === 'migrate') env.DIRECT_URL = migrationUrl;
if (command === 'dev' && env.NEXT_PUBLIC_CONTRACT_ADDRESS) {
  const journal = JSON.parse(readFileSync(`${root}.tools/arc-lifecycle/journal.json`, 'utf8'));
  const wallets = JSON.parse(
    readFileSync(`${root}.tools/arc-lifecycle/wallets.json`, 'utf8'),
  ).wallets;
  if (
    env.NEXT_PUBLIC_CHAIN_ID !== '5042002' ||
    journal.chainId !== 5042002 ||
    journal.proxy?.toLowerCase() !== env.NEXT_PUBLIC_CONTRACT_ADDRESS.toLowerCase()
  )
    throw new Error('Arc profile and deployment journal mismatch');
  for (const [key, role] of [
    ['ADMIN_PRIVATE_KEY', 'owner'],
    ['SCHEDULER_PRIVATE_KEY', 'owner'],
    ['SETTLER_PRIVATE_KEY', 'settler'],
  ]) {
    if (env[key] && env[key] !== wallets[role].privateKey)
      throw new Error('Only fresh Arc test signers are allowed');
  }
}
const [script, ...args] = commands[command];
const result = spawnSync(process.execPath, [`${root}${script}`, ...args], {
  cwd: `${root}apps/web`,
  env,
  stdio: 'inherit',
});
if (result.error) throw new Error('Development command could not start');
process.exitCode = result.status ?? 1;
if (command === 'migrate' && result.status === 0) {
  const secured = spawnSync(
    process.execPath,
    [`${root}node_modules/tsx/dist/cli.mjs`, 'src/scripts/development-database.ts', 'access'],
    {
      cwd: `${root}apps/web`,
      env: { ...env, DATABASE_URL: migrationUrl },
      stdio: 'inherit',
    },
  );
  process.exitCode = secured.status ?? 1;
}
