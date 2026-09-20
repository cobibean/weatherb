/** Arc's native balance and payable value use 18 decimals, not ERC-20 USDC's six. */
export const ARC_TESTNET = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.io'] } },
  blockExplorers: { default: { name: 'Arc Explorer', url: 'https://explorer.testnet.arc.io' } },
  testnet: true,
} as const;

export function assertArcChain(chainId: number): void {
  if (chainId !== ARC_TESTNET.id)
    throw new Error('Switch to Arc Testnet (5042002) before continuing.');
}

export function arcTransactionUrl(hash: string): string {
  return `${ARC_TESTNET.blockExplorers.default.url}/tx/${hash}`;
}

/** Reject rather than round values smaller than the native unit. */
export function parseNativeUsdc(value: string): bigint {
  if (!/^\d+(\.\d{1,18})?$/.test(value))
    throw new Error('Enter a USDC amount with at most 18 decimal places.');
  const [whole = '0', fraction = ''] = value.split('.');
  return BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, '0'));
}
