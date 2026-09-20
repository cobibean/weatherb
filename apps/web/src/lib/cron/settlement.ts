import { WEATHER_MARKET_ABI } from '@weatherb/shared/abi';
import { createWeatherProviderFromEnv } from '@weatherb/shared/providers';
import {
  SETTLEMENT_WINDOW_SECONDS,
  validateSettlementReading,
} from '@weatherb/shared/utils/weather-timing';
import { keccak256, toBytes, type Hex } from 'viem';
import prisma from '@/lib/prisma';
import { recordProviderError, recordProviderSuccess } from '@/lib/provider-health';
import type { ContractClients } from './contract';
import { isTerminal, persistMarket, readMarket } from './market-state';
import { redactError } from './worker-run';

/** A submission younger than this with no receipt is still considered in flight. */
export const IN_FLIGHT_GRACE_SECONDS = 180;

export type SettlementResult = {
  marketId: string;
  action: 'pending' | 'reconciled' | 'settled' | 'cancelled' | 'in_flight';
  transactionHash?: Hex;
};

export async function settleMarket(
  clients: ContractClients,
  address: Hex,
  id: bigint,
): Promise<SettlementResult> {
  const { publicClient, walletClient } = clients;
  const marketId = id.toString();
  const contractMarketId = Number(id);
  const market = await readMarket(publicClient, address, id);
  if (isTerminal(market)) {
    await persistMarket(id, market);
    return { marketId, action: 'reconciled' as const };
  }
  const target = Number(market.resolveTime);
  const now = Math.floor(Date.now() / 1000);
  if (now < target) return { marketId, action: 'pending' as const };
  await persistMarket(id, market); // Guarantees a row exists for tracking fields below.
  const row = await prisma.market.findUnique({
    where: { contractMarketId },
    select: { settlementTxHash: true, settlementSubmittedAt: true },
  });
  if (row?.settlementTxHash && row.settlementSubmittedAt) {
    const hash = row.settlementTxHash as Hex;
    const receipt = await publicClient.getTransactionReceipt({ hash }).catch(() => null);
    if (receipt?.status === 'success') {
      const confirmed = await readMarket(publicClient, address, id);
      if (isTerminal(confirmed)) {
        await persistMarket(id, confirmed);
        return { marketId, action: 'reconciled' as const, transactionHash: hash };
      }
    }
    const age = now - Math.floor(row.settlementSubmittedAt.getTime() / 1000);
    if (!receipt && age < IN_FLIGHT_GRACE_SECONDS)
      return { marketId, action: 'in_flight' as const, transactionHash: hash };
  }
  const attempt = async (error?: unknown): Promise<void> => {
    await prisma.market.update({
      where: { contractMarketId },
      data: {
        settlementAttempts: { increment: 1 },
        lastSettlementAttemptAt: new Date(),
        lastSettlementError: error === undefined ? null : redactError(error),
      },
    });
  };
  let transactionHash: Hex;
  if (now > target + SETTLEMENT_WINDOW_SECONDS) {
    // Current observations are no longer valid. Release every stake, including one-sided pools.
    const { request } = await publicClient.simulateContract({
      address,
      abi: WEATHER_MARKET_ABI,
      functionName: 'cancelMarketBySettler',
      args: [id],
      account: walletClient.account!,
    });
    await attempt();
    transactionHash = await walletClient.writeContract(request);
  } else {
    const cities = await prisma.city.findMany();
    const city = cities.find(
      (candidate) =>
        keccak256(toBytes(candidate.slug)).toLowerCase() === market.cityId.toLowerCase(),
    );
    if (!city) throw new Error(`Unknown city for market ${id}`);
    const provider = createWeatherProviderFromEnv();
    let reading;
    try {
      reading = await provider.getFirstReadingAtOrAfter(city.latitude, city.longitude, target);
      validateSettlementReading(reading, target);
      await recordProviderSuccess();
    } catch (error) {
      await recordProviderError();
      await attempt(error);
      throw error; // Retry on the next invocation while the window remains open.
    }
    const { request } = await publicClient.simulateContract({
      address,
      abi: WEATHER_MARKET_ABI,
      functionName: 'resolveMarket',
      args: [id, BigInt(reading.tempF_tenths), BigInt(reading.observedTimestamp)],
      account: walletClient.account!,
    });
    await attempt();
    transactionHash = await walletClient.writeContract(request);
  }
  // Record the hash first so a crash before the receipt is recognised as in flight, not lost.
  await prisma.market.update({
    where: { contractMarketId },
    data: { settlementTxHash: transactionHash, settlementSubmittedAt: new Date() },
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash });
  if (receipt.status !== 'success')
    throw new Error(`Settlement transaction reverted: ${transactionHash}`);
  const confirmed = await readMarket(publicClient, address, id);
  if (!isTerminal(confirmed)) throw new Error(`Settlement not confirmed: ${transactionHash}`);
  // Propagate DB failures. The next invocation reconciles this terminal state without another write.
  await persistMarket(id, confirmed);
  return {
    marketId,
    action: confirmed.status === 3 ? ('cancelled' as const) : ('settled' as const),
    transactionHash,
  };
}
