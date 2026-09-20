import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const version = readFileSync(new URL('.foundry-version', root), 'utf8').trim();
const destination = fileURLToPath(new URL(`.tools/foundry/${version}/`, root));
const installed = spawnSync(`${destination}/forge`, ['--version'], { encoding: 'utf8' });
if (installed.status === 0 && installed.stdout.match(/Version: (\d+\.\d+\.\d+)/)?.[1] === version) {
  console.log(`Foundry ${version} is already installed locally.`);
  process.exit(0);
}

const arch = { x64: 'amd64', arm64: 'arm64' }[process.arch];
const name = `foundry_v${version}_${process.platform}_${arch}.tar.gz`;
const artifacts = JSON.parse(
  readFileSync(new URL('foundry-artifacts.json', import.meta.url), 'utf8'),
);
const artifact = artifacts[name];
if (!artifact)
  throw new Error(
    `Unsupported platform: ${process.platform}/${process.arch}. Use Linux/WSL or macOS.`,
  );

mkdirSync(destination, { recursive: true });
const archive = `${destination}/${name}`;
// Resume interrupted downloads; verify against the committed release checksum.
const download = spawnSync(
  'curl',
  [
    '--fail',
    '--location',
    '--silent',
    '--show-error',
    '--retry',
    '3',
    '--continue-at',
    '-',
    '--output',
    archive,
    artifact.url,
  ],
  { stdio: 'inherit' },
);
if (download.status !== 0) throw new Error('Foundry download failed; rerun setup to resume.');
const hash = createHash('sha256').update(readFileSync(archive)).digest('hex');
if (hash !== artifact.sha256) {
  rmSync(archive);
  throw new Error('Foundry checksum mismatch; archive removed.');
}
const extract = spawnSync('tar', ['-xzf', archive, '-C', destination], { stdio: 'inherit' });
if (extract.status !== 0) throw new Error('Could not extract Foundry.');
rmSync(archive);
const verify = spawnSync(`${destination}/forge`, ['--version'], { encoding: 'utf8' });
if (verify.status !== 0 || verify.stdout.match(/Version: (\d+\.\d+\.\d+)/)?.[1] !== version) {
  throw new Error('Downloaded Foundry version did not match the pin.');
}
console.log(`Installed Foundry ${version} in ${destination}`);
