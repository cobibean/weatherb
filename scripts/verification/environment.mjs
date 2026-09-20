// Keep only process-launch essentials. Never forward service credentials.
export function verificationEnvironment(source = process.env) {
  const env = {};
  for (const key of ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot', 'CI']) {
    if (source[key]) env[key] = source[key];
  }
  return {
    ...env,
    WEATHERB_VERIFY: '1',
    NEXT_TELEMETRY_DISABLED: '1',
    DATABASE_URL: 'postgresql://verification:verification@127.0.0.1:1/weatherb_unavailable',
    RPC_URL: 'http://127.0.0.1:1',
    NEXT_PUBLIC_RPC_URL: 'http://127.0.0.1:1',
    NEXT_PUBLIC_CHAIN_ID: '5042002',
    NEXT_PUBLIC_CONTRACT_ADDRESS: '0x0000000000000000000000000000000000000001',
    NEXT_PUBLIC_THIRDWEB_CLIENT_ID: 'verification-only',
    NODE_OPTIONS: `--import=${new URL('./network-guard.mjs', import.meta.url).href}`,
  };
}
