import { readFileSync, realpathSync, statSync } from 'node:fs';

// No caller-supplied database is accepted. The runner creates a private cluster
// and records its exact URL before migrations or test fixtures may connect.
export function assertDisposableDatabase(env = process.env) {
  const failure = () => {
    throw new Error('Database tests require a runner-owned disposable PostgreSQL cluster');
  };
  try {
    if (!env.WEATHERB_TEST_SOCKET || !env.WEATHERB_TEST_TOKEN || !env.DATABASE_URL)
      return failure();
    const socket = realpathSync(env.WEATHERB_TEST_SOCKET);
    if (!/\/weatherb-test-[^/]+$/.test(socket)) return failure();
    if ((statSync(socket).mode & 0o077) !== 0) return failure();
    const marker = JSON.parse(readFileSync(`${socket}/owner.json`, 'utf8'));
    const url = new URL(env.DATABASE_URL);
    if (
      marker.token !== env.WEATHERB_TEST_TOKEN ||
      marker.url !== env.DATABASE_URL ||
      url.protocol !== 'postgresql:' ||
      url.hostname !== 'localhost' ||
      url.pathname !== '/weatherb_test' ||
      url.searchParams.get('host') !== socket ||
      env.DIRECT_URL !== env.DATABASE_URL
    )
      return failure();
    return env.DATABASE_URL;
  } catch {
    return failure();
  }
}
