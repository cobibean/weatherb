import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workerEnvironment, PUBLIC_PROJECT_ID } from '../development/worker-profile.mjs';

const settings = {
  WEATHERB_DATABASE_TARGET: 'neon',
  WEATHERB_NEON_ENDPOINT: 'ep-example-123',
  NEXT_PUBLIC_CHAIN_ID: '5042002',
  NEXT_PUBLIC_CONTRACT_ADDRESS: '0x1111111111111111111111111111111111111111',
  NEXT_PUBLIC_THIRDWEB_CLIENT_ID: 'client',
  RPC_URL: 'https://rpc.testnet.arc.io',
  DATABASE_URL:
    'postgresql://weatherb_worker:test@ep-example-123-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=verify-full',
  SETTLER_PRIVATE_KEY: `0x${'a'.repeat(64)}`,
  SCHEDULER_PRIVATE_KEY: `0x${'b'.repeat(64)}`,
  CRON_SECRET: 'c'.repeat(64),
  TOMORROW_IO_API_KEY: 'weather',
  QSTASH_TOKEN: 'qstash',
  VERCEL_ORG_ID: 'team_2l4gGocPPIEpAB4OWmKXM5LJ',
  VERCEL_PROJECT_ID: 'prj_workerworkerworkerworker',
  WORKER_URL: 'https://weatherb-arc-worker.vercel.app',
};

test('worker profile produces only runtime variables and marks the deployment as the worker', () => {
  const env = workerEnvironment({ ...settings, DIRECT_URL: 'must-not-export', ADMIN_PRIVATE_KEY: 'no', ADMIN_WALLETS: 'no', ADMIN_WRITES_ENABLED: 'true' });
  assert.equal(env.vercelEnv.WEATHERB_WORKER_ROLE, 'settler');
  assert.equal(env.vercelEnv.WEATHERB_ENV_FILE, 'none');
  assert.equal(env.vercelEnv.APP_URL, settings.WORKER_URL);
  for (const key of ['DIRECT_URL', 'ADMIN_PRIVATE_KEY', 'ADMIN_WALLETS', 'ADMIN_WRITES_ENABLED', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID'])
    assert.equal(env.vercelEnv[key], undefined);
  assert.deepEqual(env.cli, { VERCEL_ORG_ID: settings.VERCEL_ORG_ID, VERCEL_PROJECT_ID: settings.VERCEL_PROJECT_ID });
});

test('worker profile refuses the public project, missing signer, wrong DB role, and weak secrets', () => {
  for (const replacement of [
    { VERCEL_PROJECT_ID: PUBLIC_PROJECT_ID },
    { VERCEL_ORG_ID: 'team_other' },
    { SETTLER_PRIVATE_KEY: undefined },
    { SETTLER_PRIVATE_KEY: '0x1234' },
    { CRON_SECRET: 'short' },
    { TOMORROW_IO_API_KEY: '' },
    { DATABASE_URL: settings.DATABASE_URL.replace('weatherb_worker', 'weatherb_app') },
    { DATABASE_URL: settings.DATABASE_URL.replace('verify-full', 'require') },
    { WORKER_URL: 'http://weatherb-arc-worker.vercel.app' },
    { WORKER_URL: 'https://weatherb.vercel.app' },
    { RPC_URL: 'https://other.example' },
  ])
    assert.throws(() => workerEnvironment({ ...settings, ...replacement }), undefined, JSON.stringify(replacement));
});

test('worker profile requires a distinct scheduler key and forwards it', () => {
  const env = workerEnvironment(settings);
  assert.equal(env.vercelEnv.SCHEDULER_PRIVATE_KEY, settings.SCHEDULER_PRIVATE_KEY);
  assert.throws(() => workerEnvironment({ ...settings, SCHEDULER_PRIVATE_KEY: '' }), /SCHEDULER_PRIVATE_KEY/);
  assert.throws(() => workerEnvironment({ ...settings, SCHEDULER_PRIVATE_KEY: settings.SETTLER_PRIVATE_KEY }), /must differ/);
});

test('market maker key is optional while disabled and forwarded only to the worker when configured', () => {
  assert.equal(workerEnvironment(settings).vercelEnv.MARKET_MAKER_PRIVATE_KEY, undefined);
  const maker = `0x${'c'.repeat(64)}`;
  const env = workerEnvironment({ ...settings, MARKET_MAKER_PRIVATE_KEY: maker });
  assert.equal(env.vercelEnv.MARKET_MAKER_PRIVATE_KEY, maker);
  assert.throws(() => workerEnvironment({ ...settings, MARKET_MAKER_PRIVATE_KEY: settings.SETTLER_PRIVATE_KEY }), /must differ/);
  assert.throws(() => workerEnvironment({ ...settings, MARKET_MAKER_PRIVATE_KEY: '0x12' }), /malformed/);
});
