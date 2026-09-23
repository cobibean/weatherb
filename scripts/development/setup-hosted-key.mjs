import { mkdirSync, existsSync, readFileSync, writeFileSync, chmodSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { ARC_TESTNET, assertArcChain } from '../../packages/shared/src/constants/arc.ts';
const role = process.argv[2];
if (!['settler', 'scheduler', 'market-maker'].includes(role)) throw new Error('Use setup-hosted-key.mjs settler|scheduler|market-maker');
const dir = fileURLToPath(new URL('../../.tools/arc-hosted', import.meta.url));
mkdirSync(dir, { recursive: true, mode: 0o700 });
chmodSync(dir, 0o700);
const path = `${dir}/${role}.json`;
if (!existsSync(path)) {
  const privateKey = generatePrivateKey();
  writeFileSync(path, JSON.stringify({ role, chainId: ARC_TESTNET.id, createdAt: new Date().toISOString(), address: privateKeyToAccount(privateKey).address, privateKey }, null, 2), { mode: 0o600, flag: 'wx' });
}
if (statSync(path).mode & 0o077) throw new Error(`Hosted ${role} file permissions must be 0600`);
const saved = JSON.parse(readFileSync(path));
assertArcChain(saved.chainId);
if (!/^0x[0-9a-fA-F]{64}$/.test(saved.privateKey ?? '') || privateKeyToAccount(saved.privateKey).address.toLowerCase() !== saved.address?.toLowerCase())
  throw new Error('Hosted key file does not match its public address');
for (const otherRole of ['settler', 'scheduler']) {
  if (otherRole === role) continue;
  const otherPath = `${dir}/${otherRole}.json`;
  if (existsSync(otherPath)) {
    const other = JSON.parse(readFileSync(otherPath));
    if (other.address?.toLowerCase() === saved.address.toLowerCase()) throw new Error('Hosted signer roles must use distinct addresses');
  }
}
console.log(`hosted ${role}: ${saved.address}`);
console.log(`Copy the private key into .env.arc-worker as ${role === 'market-maker' ? 'MARKET_MAKER' : role.toUpperCase()}_PRIVATE_KEY by hand (never via chat or logs).`);
