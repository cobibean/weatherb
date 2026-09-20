import net from 'node:net';
import tls from 'node:tls';
import dgram from 'node:dgram';
import { syncBuiltinESMExports } from 'node:module';

// Installed before test/application imports, including in worker processes.
// Only the runner-owned PostgreSQL Unix socket is allowed for database tests.
const originalConnect = net.Socket.prototype.connect;
let attempts = 0;
export function takeBlockedAttempts() {
  const count = attempts;
  attempts = 0;
  return count;
}
const blocked = () => {
  attempts++;
  throw new Error('Verification blocked unexpected network access');
};
net.Socket.prototype.connect = function (...args) {
  const options = Array.isArray(args[0]) ? args[0][0] : args[0];
  const path = typeof options === 'string' ? options : options?.path;
  const socket = process.env.WEATHERB_TEST_SOCKET;
  const buildWorker =
    process.env.WEATHERB_VERIFY_BUILD === '1' &&
    process.argv[1]?.includes('/apps/web/.next/build/');
  if (buildWorker && options?.host === '127.0.0.1' && options.port === Number(process.argv[2])) {
    return originalConnect.apply(this, args);
  }
  if (socket && path === `${socket}/.s.PGSQL.5432`) {
    return originalConnect.apply(this, args);
  }
  return blocked();
};
tls.connect = blocked;
dgram.createSocket = blocked;
globalThis.fetch = blocked;
if ('WebSocket' in globalThis)
  globalThis.WebSocket = class {
    constructor() {
      blocked();
    }
  };
syncBuiltinESMExports();
