import { ARC_TESTNET, assertArcChain } from '../../packages/shared/src/constants/arc.ts';
import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
import { randomBytes } from 'node:crypto';
const root = fileURLToPath(new URL('../../', import.meta.url));
const path = `${root}.env.arc-dev`;
const env = parse(readFileSync(path));
const saved = JSON.parse(readFileSync(`${root}.tools/arc-lifecycle/wallets.json`));
assertArcChain(saved.chainId);
const journal = JSON.parse(readFileSync(`${root}.tools/arc-lifecycle/journal.json`));
if (journal.chainId !== ARC_TESTNET.id || !/^0x[0-9a-fA-F]{40}$/.test(journal.proxy))
  throw new Error('Deploy first');
if (
  env.NEXT_PUBLIC_CONTRACT_ADDRESS &&
  env.NEXT_PUBLIC_CONTRACT_ADDRESS.toLowerCase() !== journal.proxy.toLowerCase()
)
  throw new Error('Refusing to replace another deployment');
Object.assign(env, {
  NEXT_PUBLIC_CHAIN_ID: String(ARC_TESTNET.id),
  RPC_URL: ARC_TESTNET.rpcUrls.default.http[0],
  NEXT_PUBLIC_CONTRACT_ADDRESS: journal.proxy,
  SCHEDULER_PRIVATE_KEY: saved.wallets.owner.privateKey,
  ADMIN_PRIVATE_KEY: saved.wallets.owner.privateKey,
  SETTLER_PRIVATE_KEY: saved.wallets.settler.privateKey,
  CRON_SECRET: env.CRON_SECRET || randomBytes(32).toString('hex'),
});
writeFileSync(
  path,
  Object.entries(env)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join('\n') + '\n',
  { mode: 0o600 },
);
chmodSync(path, 0o600);
console.log(
  'Fresh Arc deployment configured in the isolated local profile. Hosted configuration unchanged.',
);
