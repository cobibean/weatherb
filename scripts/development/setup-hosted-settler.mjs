import { mkdirSync, existsSync, readFileSync, writeFileSync, chmodSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { ARC_TESTNET, assertArcChain } from '../../packages/shared/src/constants/arc.ts';
const dir = fileURLToPath(new URL('../../.tools/arc-hosted', import.meta.url));
mkdirSync(dir, { recursive: true, mode: 0o700 });
chmodSync(dir, 0o700);
const path = `${dir}/settler.json`;
if (!existsSync(path)) {
  const privateKey = generatePrivateKey();
  writeFileSync(
    path,
    JSON.stringify({ chainId: ARC_TESTNET.id, createdAt: new Date().toISOString(), address: privateKeyToAccount(privateKey).address, privateKey }, null, 2),
    { mode: 0o600, flag: 'wx' },
  );
}
if (statSync(path).mode & 0o077) throw new Error('Hosted settler file permissions must be 0600');
const saved = JSON.parse(readFileSync(path));
assertArcChain(saved.chainId);
console.log(`hosted settler: ${saved.address}`);
console.log('Copy the private key into .env.arc-worker as SETTLER_PRIVATE_KEY by hand (never via chat or logs).');
