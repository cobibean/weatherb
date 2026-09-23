import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hostedEnvironment } from '../development/hosted-profile.mjs';

const settings = {
  WEATHERB_DATABASE_TARGET: 'neon',
  WEATHERB_NEON_ENDPOINT: 'ep-example-123',
  NEXT_PUBLIC_CHAIN_ID: '5042002',
  NEXT_PUBLIC_CONTRACT_ADDRESS: '0x1111111111111111111111111111111111111111',
  RPC_URL: 'https://rpc.testnet.arc.io',
  DATABASE_URL:
    'postgresql://weatherb_app:test@ep-example-123-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=verify-full',
  DIRECT_URL:
    'postgresql://weatherb_migrator:test@ep-example-123.c-7.us-east-2.aws.neon.tech/neondb?sslmode=verify-full',
};

test('hosted profile excludes signing, weather, admin, and inherited configuration', () => {
  const env = hostedEnvironment({
    ...settings,
    SETTLER_PRIVATE_KEY: 'must-not-export',
    ADMIN_PRIVATE_KEY: 'must-not-export',
    TOMORROW_IO_API_KEY: 'must-not-export',
    CRON_SECRET: 'must-not-export',
    MARKET_MAKER_PRIVATE_KEY: 'must-not-export',
    LIQUIDITY_ADMIN_WRITES_ENABLED: 'true',
  });
  assert.equal(env.WEATHERB_ENV_FILE, 'none');
  for (const key of [
    'SETTLER_PRIVATE_KEY',
    'ADMIN_PRIVATE_KEY',
    'TOMORROW_IO_API_KEY',
    'CRON_SECRET',
    'MARKET_MAKER_PRIVATE_KEY',
  ])
    assert.equal(env[key], undefined);
  assert.equal(env.LIQUIDITY_ADMIN_WRITES_ENABLED, 'true');
});

test('hosted profile rejects different databases, endpoints, roles, chain and unverified TLS', () => {
  for (const replacement of [
    { WEATHERB_DATABASE_TARGET: 'local' },
    { NEXT_PUBLIC_CHAIN_ID: '1' },
    { RPC_URL: 'https://other.example' },
    { DATABASE_URL: settings.DATABASE_URL.replace('ep-example-123', 'ep-other-123') },
    { DATABASE_URL: settings.DATABASE_URL.replace('weatherb_app', 'neondb_owner') },
    { DATABASE_URL: settings.DATABASE_URL.replace('verify-full', 'require') },
    { DIRECT_URL: settings.DIRECT_URL.replace('/neondb', '/other') },
    {
      DIRECT_URL: settings.DIRECT_URL.replace('.aws.neon.tech', '.aws.neon.tech.attacker.example'),
    },
  ])
    assert.throws(() => hostedEnvironment({ ...settings, ...replacement }));
});
