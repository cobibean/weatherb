'use client';

import { useEffect, useState } from 'react';
import { ARC_TESTNET, assertArcChain } from '@weatherb/shared/constants';
import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import { defineChain } from 'thirdweb';
import { createWallet, type Wallet, type WalletId } from 'thirdweb/wallets';
import { createPublicClient, encodeFunctionData, http, type Hex } from 'viem';

export const appChain = defineChain({
  id: ARC_TESTNET.id,
  name: ARC_TESTNET.name,
  rpc: ARC_TESTNET.rpcUrls.default.http[0],
  nativeCurrency: ARC_TESTNET.nativeCurrency,
  blockExplorers: [ARC_TESTNET.blockExplorers.default],
  testnet: true,
});

export const arcConnectOptions = {
  wallets: (['io.metamask', 'io.rabby', 'walletConnect'] as WalletId[]).map((id) =>
    createWallet(id),
  ),
  showAllWallets: false,
  supportedTokens: { [ARC_TESTNET.id]: [] },
  detailsModal: { hideBuyFunds: true, assetTabs: [] },
};

const client = createPublicClient({ chain: ARC_TESTNET, transport: http() });

export async function readArcSettings(): Promise<{
  address: Hex;
  minBetWei: bigint;
  feeBps: bigint;
}> {
  assertArcChain(Number(process.env.NEXT_PUBLIC_CHAIN_ID));
  assertArcChain(await client.getChainId());
  const address = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Hex;
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address))
    throw new Error('Arc deployment is not configured.');
  const read = <const N extends 'version' | 'minBetWei' | 'feeBps'>(functionName: N) =>
    client.readContract({ address, abi: WEATHER_MARKET_ABI, functionName });
  const [version, minBetWei, feeBps] = await Promise.all([
    read('version'),
    read('minBetWei'),
    read('feeBps'),
  ]);
  if (version !== '2.2.0')
    throw new Error('The configured address is not the Arc restart contract.');
  return { address, minBetWei, feeBps };
}

/** Switch explicitly, simulate, and reserve the maximum estimated gas cost before signing. */
export async function prepareArcAction(
  wallet: Wallet | undefined,
  account: Hex,
  marketId: bigint,
  value?: bigint,
): Promise<void> {
  if (!wallet || wallet.getAccount()?.address.toLowerCase() !== account.toLowerCase())
    throw new Error('Reconnect your wallet before continuing.');
  if (wallet.getChain()?.id !== ARC_TESTNET.id) await wallet.switchChain(appChain);
  assertArcChain(wallet.getChain()?.id ?? 0);
  const settings = await readArcSettings();
  if (value !== undefined && value < settings.minBetWei)
    throw new Error('Your amount is below the current minimum bet.');
  // The caller supplies side-specific simulation through prepareArcBet below.
  if (value === undefined) {
    await client.simulateContract({
      address: settings.address,
      abi: WEATHER_MARKET_ABI,
      functionName: 'claim',
      args: [marketId],
      account,
    });
    await checkGas(
      account,
      settings.address,
      encodeFunctionData({ abi: WEATHER_MARKET_ABI, functionName: 'claim', args: [marketId] }),
      0n,
    );
  }
}

async function checkGas(account: Hex, to: Hex, data: Hex, value: bigint): Promise<void> {
  const [gas, fees, balance] = await Promise.all([
    client.estimateGas({ account, to, data, value }),
    client.estimateFeesPerGas(),
    client.getBalance({ address: account }),
  ]);
  const gasReserve = (gas * fees.maxFeePerGas * 120n) / 100n;
  if (balance < value + gasReserve)
    throw new Error('Insufficient USDC for the amount plus network fees. Leave some USDC for gas.');
}

export async function prepareArcBet(
  wallet: Wallet | undefined,
  account: Hex,
  marketId: bigint,
  isYes: boolean,
  value: bigint,
): Promise<void> {
  await prepareArcAction(wallet, account, marketId, value);
  const address = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Hex;
  await client.simulateContract({
    address,
    abi: WEATHER_MARKET_ABI,
    functionName: 'placeBet',
    args: [marketId, isYes],
    account,
    value,
  });
  await checkGas(
    account,
    address,
    encodeFunctionData({
      abi: WEATHER_MARKET_ABI,
      functionName: 'placeBet',
      args: [marketId, isYes],
    }),
    value,
  );
}

export async function confirmArcTransaction(hash: Hex): Promise<void> {
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success')
    throw new Error('Transaction reverted. No successful action was recorded.');
}

/** Hide estimates when the deployed fee is unavailable instead of assuming the default. */
export function useArcSettings(): { minBetWei: bigint; feeBps: bigint } | null {
  const [settings, setSettings] = useState<{ minBetWei: bigint; feeBps: bigint } | null>(null);
  useEffect(() => {
    let active = true;
    readArcSettings()
      .then((value) => {
        if (active) setSettings(value);
      })
      .catch(() => {
        if (active) setSettings(null);
      });
    return () => {
      active = false;
    };
  }, []);
  return settings;
}
