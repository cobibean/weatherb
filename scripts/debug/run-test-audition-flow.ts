#!/usr/bin/env npx tsx
import fs from 'node:fs';
import path from 'node:path';

function loadEnv(): void {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

async function main() {
  loadEnv();
  const suggestionId = process.argv[2];
  if (!suggestionId) {
    console.error('Usage: npx tsx scripts/debug/run-test-audition-flow.ts <suggestion-id>');
    process.exit(1);
  }

  const { startTestWindow } = await import('../../apps/web/src/lib/test-runner');
  const testRun = await startTestWindow(suggestionId);
  console.log(JSON.stringify({ testRunId: testRun.id, status: testRun.status }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
