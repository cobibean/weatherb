import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { verificationEnvironment } from './environment.mjs';
import { assertDisposableDatabase } from './test-database.mjs';

test('verification removes inherited credentials and injection flags', () => {
  const env = verificationEnvironment({
    PATH: '/bin',
    DATABASE_URL: 'postgresql://shared.example/production',
    SETTLER_PRIVATE_KEY: 'secret',
    QSTASH_TOKEN: 'secret',
    NODE_OPTIONS: '--require=unexpected.cjs',
    WEATHERB_TEST_SOCKET: '/tmp/shared',
    WEATHERB_TEST_TOKEN: 'secret',
  });
  assert.equal(env.SETTLER_PRIVATE_KEY, undefined);
  assert.equal(env.QSTASH_TOKEN, undefined);
  assert.equal(env.WEATHERB_TEST_SOCKET, undefined);
  assert.equal(
    env.DATABASE_URL,
    'postgresql://verification:verification@127.0.0.1:1/weatherb_unavailable',
  );
  assert.match(env.NODE_OPTIONS, /network-guard.mjs/);
  assert.ok(!JSON.stringify(env).includes('secret'));
});
for (const url of [
  undefined,
  'postgresql://localhost/weatherb_test',
  'postgresql://localhost/production',
  'postgresql://remote.supabase.co/weatherb_test',
  'postgresql://localhost/weatherb_test?host=/tmp/shared',
]) {
  test(`database guard rejects unowned target ${url ?? '(missing)'}`, () => {
    assert.throws(
      () => assertDisposableDatabase({ DATABASE_URL: url, DIRECT_URL: url }),
      /runner-owned/,
    );
  });
}
test('direct integration config fails before any fixture is imported', () => {
  const result = spawnSync(
    process.execPath,
    [
      join(
        dirname(
          createRequire(new URL('../../apps/web/package.json', import.meta.url)).resolve(
            'vitest/package.json',
          ),
        ),
        'vitest.mjs',
      ),
      'run',
      '--config',
      'vitest.database.config.ts',
      '--root',
      'apps/web',
    ],
    { env: verificationEnvironment(), encoding: 'utf8' },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /runner-owned/);
  assert.doesNotMatch(result.stdout, /Test Files/);
});
test('network guard blocks fetch, TCP, TLS, HTTP, UDP and WebSocket before connection', () => {
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import assert from 'node:assert/strict';
    import net from 'node:net'; import tls from 'node:tls'; import http from 'node:http'; import dgram from 'node:dgram';
    for (const operation of [
      () => fetch('https://example.invalid'),
      () => net.connect({ host: '127.0.0.1', port: 5432 }),
      () => net.connect({ path: '/tmp/shared/.s.PGSQL.5432' }),
      () => tls.connect({ host: 'example.invalid', port: 443 }),
      () => http.get('http://example.invalid'),
      () => dgram.createSocket('udp4'),
      () => new WebSocket('wss://example.invalid'),
    ]) assert.throws(operation, /Verification blocked/);
  `,
    ],
    { env: verificationEnvironment(), encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
});
