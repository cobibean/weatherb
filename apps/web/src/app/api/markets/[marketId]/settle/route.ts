import { NextRequest, NextResponse } from 'next/server';
import type { Hex } from 'viem';
import { createWeatherProviderFromEnv } from '@weatherb/shared/providers';
import type { WeatherReading } from '@weatherb/shared/types';
import { formatFlr } from '@weatherb/shared/utils/payout';
import { calculateSettlement } from '@weatherb/shared/utils/settlement';
import { createContractClients, verifyCronRequest, unauthorizedResponse, WEATHER_MARKET_ABI } from '@/lib/cron';
import { recordProviderError, recordProviderSuccess } from '@/lib/provider-health';
import { createGoogleSheetsClient, toSheetsStatusLabel } from '@/lib/google-sheets';
import prisma from '@/lib/prisma';
import { claimSheetsLoggingRights } from '@/lib/sheets-logging';

const STATUS_MAP = ['Open', 'Closed', 'Resolved', 'Cancelled', 'NoWinners'] as const;

type SettlementResult = {
  marketId: string;
  transactionHash: Hex;
  tempTenths: number;
  observedTimestamp: number;
  provider: string;
};

/**
 * POST /api/markets/[marketId]/settle
 *
 * Settle a single market by contract market ID.
 */
type RouteParams = {
  params: Promise<{
    marketId: string;
  }>;
};

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  if (!verifyCronRequest(request)) {
    return unauthorizedResponse();
  }

  const rpcUrl = process.env.RPC_URL;
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Hex | undefined;
  const privateKey = process.env.SETTLER_PRIVATE_KEY as Hex | undefined;

  if (!rpcUrl || !contractAddress || !privateKey) {
    console.error('Missing required environment variables: RPC_URL, NEXT_PUBLIC_CONTRACT_ADDRESS, SETTLER_PRIVATE_KEY');
    return NextResponse.json(
      { success: false, error: 'Missing configuration: RPC_URL, NEXT_PUBLIC_CONTRACT_ADDRESS, SETTLER_PRIVATE_KEY' },
      { status: 500 }
    );
  }

  const { marketId } = await params;
  const marketIdNum = Number(marketId);
  if (!Number.isInteger(marketIdNum) || marketIdNum < 0) {
    return NextResponse.json(
      { success: false, error: 'Invalid marketId' },
      { status: 400 }
    );
  }

  const market = await prisma.market.findFirst({
    where: { contractMarketId: marketIdNum },
  });

  if (!market) {
    return NextResponse.json(
      { success: false, error: `Market ${marketIdNum} not found` },
      { status: 404 }
    );
  }

  try {
    const { publicClient, walletClient } = createContractClients({
      rpcUrl,
      privateKey,
    });

    const marketOnChain = await publicClient.readContract({
      address: contractAddress,
      abi: WEATHER_MARKET_ABI,
      functionName: 'getMarket',
      args: [BigInt(marketIdNum)],
    });

    const statusIndex = Number(marketOnChain.status ?? 0);
    const status = STATUS_MAP[statusIndex] ?? 'Open';

    if (status === 'Resolved' || status === 'Cancelled' || status === 'NoWinners') {
      return NextResponse.json(
        { success: false, error: `Market ${marketIdNum} already ${status}` },
        { status: 400 }
      );
    }

    const resolveTimeFromChain = marketOnChain.resolveTime ? Number(marketOnChain.resolveTime) : null;
    const resolveTimeFromDb = Math.floor(market.resolveTime.getTime() / 1000);
    const resolveTimeSec = resolveTimeFromChain ?? resolveTimeFromDb;

    if (resolveTimeFromChain && resolveTimeFromChain !== resolveTimeFromDb) {
      console.warn(
        `[SettleMarket] Resolve time mismatch for market ${marketIdNum}. Chain=${resolveTimeFromChain} DB=${resolveTimeFromDb}`
      );
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (nowSec < resolveTimeSec) {
      return NextResponse.json(
        { success: false, error: `Market ${marketIdNum} not ready for settlement` },
        { status: 400 }
      );
    }

    const provider = createWeatherProviderFromEnv();
    let reading: WeatherReading;
    try {
      reading = await provider.getFirstReadingAtOrAfter(
        market.latitude,
        market.longitude,
        resolveTimeSec
      );
      await recordProviderSuccess();
    } catch (error) {
      await recordProviderError();
      throw error;
    }

    const { request: txRequest } = await publicClient.simulateContract({
      address: contractAddress,
      abi: WEATHER_MARKET_ABI,
      functionName: 'resolveMarket',
      args: [
        BigInt(marketIdNum),
        BigInt(reading.tempF_tenths),
        BigInt(reading.observedTimestamp),
      ],
      account: walletClient.account!,
    });

    const transactionHash = await walletClient.writeContract(txRequest);
    await publicClient.waitForTransactionReceipt({ hash: transactionHash });

    const sheetsClient = createGoogleSheetsClient();
    if (sheetsClient) {
      try {
        const shouldLog = await claimSheetsLoggingRights(marketIdNum);

        if (shouldLog) {
          const settlement = calculateSettlement({
            tempTenths: reading.tempF_tenths,
            thresholdTenths: Number(marketOnChain.thresholdTenths),
            yesPool: marketOnChain.yesPool,
            noPool: marketOnChain.noPool,
          });
          const statusLabel = toSheetsStatusLabel(settlement.status);

          await sheetsClient.appendRow({
            marketId: marketIdNum.toString(),
            city: market.cityName,
            status: statusLabel,
            outcome: settlement.outcome,
            timezone: market.timezone,
            threshold: market.thresholdTemp,
            resolvedTemp: reading.tempF_tenths,
            primaryTemp: reading.tempF_tenths,
            primaryProvider: reading.source,
            altTemp1: null,
            altTemp2: null,
            altTemp3: null,
            observedTimestamp: reading.observedTimestamp,
            txHash: transactionHash,
            volume: formatFlr(marketOnChain.yesPool + marketOnChain.noPool),
          });
        }
      } catch (error) {
        console.error(`[GoogleSheets] Failed to log market ${marketIdNum}:`, error);
      }
    }

    try {
      const settlement = calculateSettlement({
        tempTenths: reading.tempF_tenths,
        thresholdTenths: Number(marketOnChain.thresholdTenths),
        yesPool: marketOnChain.yesPool,
        noPool: marketOnChain.noPool,
      });

      await prisma.market.updateMany({
        where: { contractMarketId: marketIdNum, isTest: false },
        data: {
          status: settlement.status,
          isSettled: true,
          settledAt: new Date(),
          actualTemp: reading.tempF_tenths,
          outcome: settlement.outcome,
          yesPool: settlement.yesPool,
          noPool: settlement.noPool,
        },
      });
    } catch (error) {
      console.error(`[SettleMarket] Failed to persist market ${marketIdNum}:`, error);
    }

    const result: SettlementResult = {
      marketId: marketIdNum.toString(),
      transactionHash,
      tempTenths: reading.tempF_tenths,
      observedTimestamp: reading.observedTimestamp,
      provider: reading.source,
    };

    console.log(
      `[SettleMarket] Settled market ${result.marketId} at ${result.tempTenths / 10}°F (tx ${transactionHash})`
    );

    return NextResponse.json({
      success: true,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[SettleMarket] Failed to settle market ${marketIdNum}:`, errorMessage);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
