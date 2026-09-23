/** Separate, signer-free Neon profile; never falls back to local or legacy settings. */
export function hostedEnvironment(settings) {
  if (
    settings.WEATHERB_DATABASE_TARGET !== 'neon' ||
    !/^ep-[a-z0-9-]+$/.test(settings.WEATHERB_NEON_ENDPOINT ?? '') ||
    settings.NEXT_PUBLIC_CHAIN_ID !== '5042002' ||
    !/^0x[0-9a-fA-F]{40}$/.test(settings.NEXT_PUBLIC_CONTRACT_ADDRESS ?? '') ||
    settings.RPC_URL !== 'https://rpc.testnet.arc.io'
  )
    throw new Error('Expected an explicit Neon / Arc Testnet profile');
  const env = { WEATHERB_ENV_FILE: 'none', NEXT_TELEMETRY_DISABLED: '1' };
  for (const [key, role, pooled] of [
    ['DATABASE_URL', 'weatherb_app', true],
    ['DIRECT_URL', 'weatherb_migrator', false],
  ]) {
    let url;
    try {
      url = new URL(settings[key]);
    } catch {
      throw new Error(`Invalid ${key}`);
    }
    const expected = `${settings.WEATHERB_NEON_ENDPOINT}${pooled ? '-pooler' : ''}.`;
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.password ||
      url.username !== role ||
      url.pathname !== '/neondb' ||
      !url.hostname.startsWith(expected) ||
      !url.hostname.endsWith('.aws.neon.tech') ||
      url.searchParams.get('sslmode') !== 'verify-full'
    )
      throw new Error(`Expected restricted ${role} credentials on the selected Neon endpoint`);
    env[key] = url.href;
  }
  for (const key of [
    'NEXT_PUBLIC_THIRDWEB_CLIENT_ID',
    'NEXT_PUBLIC_CHAIN_ID',
    'NEXT_PUBLIC_CONTRACT_ADDRESS',
    'RPC_URL',
  ]) {
    if (settings[key]) env[key] = settings[key];
  }
  if (settings.LIQUIDITY_ADMIN_WRITES_ENABLED !== undefined) {
    if (!['true', 'false'].includes(settings.LIQUIDITY_ADMIN_WRITES_ENABLED)) throw new Error('Invalid LIQUIDITY_ADMIN_WRITES_ENABLED');
    env.LIQUIDITY_ADMIN_WRITES_ENABLED = settings.LIQUIDITY_ADMIN_WRITES_ENABLED;
  }
  return env;
}
