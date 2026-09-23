/** Worker-only Vercel profile: the ONLY deployment that may hold settlement credentials. */
import { privateKeyToAccount } from 'viem/accounts';
export const PUBLIC_PROJECT_ID = 'prj_Xf7r8PYDcxuvtLKApRK4YvfunSfi';
export const TEAM_ID = 'team_2l4gGocPPIEpAB4OWmKXM5LJ';
export const PUBLIC_HOST = 'weatherb.vercel.app';

export function workerEnvironment(settings) {
  if (
    settings.WEATHERB_DATABASE_TARGET !== 'neon' ||
    !/^ep-[a-z0-9-]+$/.test(settings.WEATHERB_NEON_ENDPOINT ?? '') ||
    settings.NEXT_PUBLIC_CHAIN_ID !== '5042002' ||
    !/^0x[0-9a-fA-F]{40}$/.test(settings.NEXT_PUBLIC_CONTRACT_ADDRESS ?? '') ||
    settings.RPC_URL !== 'https://rpc.testnet.arc.io'
  )
    throw new Error('Expected an explicit Neon / Arc Testnet worker profile');
  if (settings.VERCEL_ORG_ID !== TEAM_ID) throw new Error('Unexpected Vercel team');
  if (!/^prj_[A-Za-z0-9]+$/.test(settings.VERCEL_PROJECT_ID ?? '') || settings.VERCEL_PROJECT_ID === PUBLIC_PROJECT_ID)
    throw new Error('Worker must target a dedicated Vercel project, never the public site');
  let workerUrl;
  try {
    workerUrl = new URL(settings.WORKER_URL);
  } catch {
    throw new Error('Invalid WORKER_URL');
  }
  if (workerUrl.protocol !== 'https:' || workerUrl.hostname === PUBLIC_HOST || !workerUrl.hostname.endsWith('.vercel.app'))
    throw new Error('WORKER_URL must be the dedicated worker deployment over HTTPS');
  let db;
  try {
    db = new URL(settings.DATABASE_URL);
  } catch {
    throw new Error('Invalid DATABASE_URL');
  }
  if (
    !['postgres:', 'postgresql:'].includes(db.protocol) ||
    !db.password ||
    db.username !== 'weatherb_worker' ||
    db.pathname !== '/neondb' ||
    !db.hostname.startsWith(`${settings.WEATHERB_NEON_ENDPOINT}-pooler.`) ||
    !db.hostname.endsWith('.aws.neon.tech') ||
    db.searchParams.get('sslmode') !== 'verify-full'
  )
    throw new Error('Expected restricted weatherb_worker credentials on the selected Neon endpoint');
  if (!/^0x[0-9a-fA-F]{64}$/.test(settings.SETTLER_PRIVATE_KEY ?? '')) throw new Error('SETTLER_PRIVATE_KEY missing or malformed');
  if (!/^0x[0-9a-fA-F]{64}$/.test(settings.SCHEDULER_PRIVATE_KEY ?? '')) throw new Error('SCHEDULER_PRIVATE_KEY missing or malformed');
  if (settings.SCHEDULER_PRIVATE_KEY.toLowerCase() === settings.SETTLER_PRIVATE_KEY.toLowerCase()) throw new Error('SCHEDULER_PRIVATE_KEY must differ from SETTLER_PRIVATE_KEY');
  if (settings.MARKET_MAKER_PRIVATE_KEY) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(settings.MARKET_MAKER_PRIVATE_KEY)) throw new Error('MARKET_MAKER_PRIVATE_KEY malformed');
    const maker = privateKeyToAccount(settings.MARKET_MAKER_PRIVATE_KEY).address.toLowerCase();
    for (const other of [settings.SETTLER_PRIVATE_KEY, settings.SCHEDULER_PRIVATE_KEY])
      if (privateKeyToAccount(other).address.toLowerCase() === maker) throw new Error('MARKET_MAKER_PRIVATE_KEY must differ from existing signers');
  }
  if ((settings.CRON_SECRET ?? '').length < 32) throw new Error('CRON_SECRET must be at least 32 characters');
  if (!settings.TOMORROW_IO_API_KEY) throw new Error('TOMORROW_IO_API_KEY required');
  if (!settings.QSTASH_TOKEN) throw new Error('QSTASH_TOKEN required');
  const vercelEnv = {
    WEATHERB_ENV_FILE: 'none',
    NEXT_TELEMETRY_DISABLED: '1',
    WEATHERB_WORKER_ROLE: 'settler',
    APP_URL: workerUrl.origin,
    DATABASE_URL: db.href,
    RPC_URL: settings.RPC_URL,
    NEXT_PUBLIC_CHAIN_ID: settings.NEXT_PUBLIC_CHAIN_ID,
    NEXT_PUBLIC_CONTRACT_ADDRESS: settings.NEXT_PUBLIC_CONTRACT_ADDRESS,
    SETTLER_PRIVATE_KEY: settings.SETTLER_PRIVATE_KEY,
    SCHEDULER_PRIVATE_KEY: settings.SCHEDULER_PRIVATE_KEY,
    CRON_SECRET: settings.CRON_SECRET,
    TOMORROW_IO_API_KEY: settings.TOMORROW_IO_API_KEY,
    QSTASH_TOKEN: settings.QSTASH_TOKEN,
  };
  if (settings.MARKET_MAKER_PRIVATE_KEY) vercelEnv.MARKET_MAKER_PRIVATE_KEY = settings.MARKET_MAKER_PRIVATE_KEY;
  if (settings.NEXT_PUBLIC_THIRDWEB_CLIENT_ID) vercelEnv.NEXT_PUBLIC_THIRDWEB_CLIENT_ID = settings.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;
  return {
    vercelEnv,
    cli: { VERCEL_ORG_ID: settings.VERCEL_ORG_ID, VERCEL_PROJECT_ID: settings.VERCEL_PROJECT_ID },
    workerUrl: workerUrl.origin,
    qstashToken: settings.QSTASH_TOKEN,
    cronSecret: settings.CRON_SECRET,
  };
}
