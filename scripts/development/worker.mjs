import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parse } from 'dotenv';
import { workerEnvironment } from './worker-profile.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const command = process.argv[2];
if (!['env-push', 'deploy', 'schedules', 'check'].includes(command))
  throw new Error('Use env-push, deploy, schedules, or check');
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
  const schedule = await client.schedules.create({
    scheduleId: 'weatherb-arc-settle-sweep',
    destination: `${worker.workerUrl}/api/cron/settle-markets`,
    cron: '*/2 * * * *',
    method: 'GET',
    retries: 0,
    headers: { Authorization: `Bearer ${worker.cronSecret}` },
  });
  console.log(JSON.stringify({ scheduleId: schedule.scheduleId, cron: '*/2 * * * *', destination: `${worker.workerUrl}/api/cron/settle-markets` }));
} else {
  const health = await fetch(`${worker.workerUrl}/api/health`);
  const anonymous = await fetch(`${worker.workerUrl}/api/cron/settle-markets`);
  const authorized = await fetch(`${worker.workerUrl}/api/cron/settle-markets`, {
    headers: { Authorization: `Bearer ${worker.cronSecret}` },
  });
  console.log(JSON.stringify({ health: { status: health.status, body: await health.json() }, anonymous: anonymous.status, authorized: { status: authorized.status, body: await authorized.json() } }, null, 2));
}
