import { mkdirSync, existsSync, readFileSync, writeFileSync, chmodSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { ARC_TESTNET, assertArcChain } from '../../packages/shared/src/constants/arc.ts';
const dir = fileURLToPath(new URL('../../.tools/arc-lifecycle', import.meta.url));
mkdirSync(dir, { recursive: true, mode: 0o700 });
chmodSync(dir, 0o700);
const path = `${dir}/wallets.json`;
if (!existsSync(path)) {
  const wallets = Object.fromEntries(
    ['owner', 'settler', 'yesBettor', 'noBettor'].map((role) => {
      const privateKey = generatePrivateKey();
      return [role, { address: privateKeyToAccount(privateKey).address, privateKey }];
    }),
  );
  writeFileSync(
    path,
    JSON.stringify(
      { chainId: ARC_TESTNET.id, createdAt: new Date().toISOString(), wallets },
      null,
      2,
    ),
    { mode: 0o600, flag: 'wx' },
  );
}
if (statSync(path).mode & 0o077) throw new Error('Wallet file permissions must be 0600');
const saved = JSON.parse(readFileSync(path));
assertArcChain(saved.chainId);
for (const [role, entry] of Object.entries(saved.wallets)) console.log(`${role}: ${entry.address}`);
