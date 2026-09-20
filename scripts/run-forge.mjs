import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const version = readFileSync(new URL('.foundry-version', root), 'utf8').trim();
const local = fileURLToPath(new URL(`.tools/foundry/${version}/forge`, root));
const binary = existsSync(local) ? local : 'forge';
const check = spawnSync(binary, ['--version'], { encoding: 'utf8' });
if (check.status !== 0 || check.stdout.match(/Version: (\d+\.\d+\.\d+)/)?.[1] !== version) {
  console.error(
    `Foundry ${version} is required. Run npm run setup:contracts from the repository root.`,
  );
  process.exit(1);
}
const result = spawnSync(binary, process.argv.slice(2), {
  cwd: fileURLToPath(new URL('contracts/', root)),
  stdio: 'inherit',
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
