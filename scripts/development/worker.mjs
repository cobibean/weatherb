import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parse } from 'dotenv';
import { workerEnvironment } from './worker-profile.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const command = process.argv[2];
if (!['env-push', 'deploy', 'schedules', 'check', 'create-now'].includes(command))
  throw new Error('Use env-push, deploy, schedules, check, or create-now');
const profile = `${root}.env.arc-worker`;
if (statSync(profile).mode & 0o077) throw new Error('Worker profile must have mode 0600');
const worker = workerEnvironment(parse(readFileSync(profile)));
const baseEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP'].includes(key)),
);
const cliEnv = { ...baseEnv, ...worker.cli };
function vercel(args, input) {
  const result = spawnSync('vercel', args, { cwd: root, env: cliEnv, input, stdio: input === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'] });
  if (result.error) throw new Error('Vercel CLI could not start');
  return result.status ?? 1;
}
if (command === 'env-push') {
  for (const [key, value] of Object.entries(worker.vercelEnv)) {
    vercel(['env', 'rm', key, 'production', '--yes']); // Ignore "not found" on first push.
    if (vercel(['env', 'add', key, 'production'], value) !== 0) throw new Error(`Failed to set ${key}`);
    console.log(`set ${key}`);
  }
} else if (command === 'deploy') {
  process.exitCode = vercel(['deploy', '--prod', '--yes']);
} else if (command === 'schedules') {
  const { Client } = await import('@upstash/qstash');
  const client = new Client({ token: worker.qstashToken });
  const headers = { Authorization: `Bearer ${worker.cronSecret}` };
  const defs = [
    { scheduleId: 'weatherb-arc-settle-sweep', cron: '*/2 * * * *', path: '/api/cron/settle-markets', retries: 0 },
    { scheduleId: 'weatherb-arc-schedule-daily', cron: '5 12-16 * * *', path: '/api/cron/schedule-daily', retries: 3 },
  ];
  for (const def of defs) {
    const destination = `${worker.workerUrl}${def.path}`;
    const schedule = await client.schedules.create({ scheduleId: def.scheduleId, destination, cron: def.cron, method: 'GET', retries: def.retries, headers });
    console.log(JSON.stringify({ scheduleId: schedule.scheduleId, cron: def.cron, destination }));
  }
} else if (command === 'create-now') {
  const response = await fetch(`${worker.workerUrl}/api/cron/schedule-daily`, { headers: { Authorization: `Bearer ${worker.cronSecret}` } });
  console.log(JSON.stringify({ status: response.status, body: await response.json() }, null, 2));
} else {
  const health = await fetch(`${worker.workerUrl}/api/health`);
  const anonymous = await fetch(`${worker.workerUrl}/api/cron/settle-markets`);
  const authorized = await fetch(`${worker.workerUrl}/api/cron/settle-markets`, {
    headers: { Authorization: `Bearer ${worker.cronSecret}` },
  });
  const scheduleAnonymous = await fetch(`${worker.workerUrl}/api/cron/schedule-daily`);
  const scheduleAuthorized = await fetch(`${worker.workerUrl}/api/cron/schedule-daily`, {
    headers: { Authorization: `Bearer ${worker.cronSecret}` },
  });
  console.log(JSON.stringify({ health: { status: health.status, body: await health.json() }, anonymous: anonymous.status, authorized: { status: authorized.status, body: await authorized.json() }, scheduleAnonymous: scheduleAnonymous.status, scheduleAuthorized: { status: scheduleAuthorized.status, body: await scheduleAuthorized.json() } }, null, 2));
}
