/**
 * Script to create a test market and immediately resolve it to verify
 * the full flow including Google Sheets logging.
 * 
 * Usage: pnpm tsx scripts/test/create-and-resolve-market.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from monorepo root
config({ path: resolve(__dirname, '../../.env') });

import { 
  createPublicClient, 
  createWalletClient, 
  http, 
  keccak256, 
  toBytes, 
  type Hex,
  parseEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { flareTestnet } from 'viem/chains';
import { WEATHER_MARKET_ABI } from '../../packages/shared/src/abi';
import { createGoogleSheetsClient } from '../../apps/web/src/lib/google-sheets';

const RPC_URL = process.env.RPC_URL!;
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as Hex;
const SCHEDULER_KEY = process.env.SCHEDULER_PRIVATE_KEY as Hex;
const SETTLER_KEY = process.env.SETTLER_PRIVATE_KEY as Hex;

// Use NYC from hardcoded cities
const CITY = {
  id: 'nyc',
  name: 'New York City',
  latitude: 40.7128,
  longitude: -74.006,
};

async function main() {
  console.log('🚀 Starting test market creation and resolution...\n');

  const schedulerAccount = privateKeyToAccount(SCHEDULER_KEY);
  const settlerAccount = privateKeyToAccount(SETTLER_KEY);

  const publicClient = createPublicClient({
    chain: flareTestnet,
    transport: http(RPC_URL),
  });

  const schedulerWallet = createWalletClient({
    account: schedulerAccount,
    chain: flareTestnet,
    transport: http(RPC_URL),
  });

  const settlerWallet = createWalletClient({
    account: settlerAccount,
    chain: flareTestnet,
    transport: http(RPC_URL),
  });

  // Create market that resolves in 12 minutes (must be > 10 min buffer)
  const cityIdBytes32 = keccak256(toBytes(CITY.id));
  const resolveTimeSec = Math.floor(Date.now() / 1000) + 720; // 12 minutes from now (> 10 min buffer)
  const thresholdTenths = 500n; // 50°F - easy to verify

  console.log(`📍 City: ${CITY.name}`);
  console.log(`🌡️  Threshold: ${Number(thresholdTenths) / 10}°F`);
  console.log(`⏰ Resolve time: ${new Date(resolveTimeSec * 1000).toISOString()}`);
  console.log('');

  // Step 1: Create market
  console.log('1️⃣ Creating market...');
  const { request: createRequest, result: marketId } = await publicClient.simulateContract({
    address: CONTRACT_ADDRESS,
    abi: WEATHER_MARKET_ABI,
    functionName: 'createMarket',
    args: [
      cityIdBytes32,
      BigInt(resolveTimeSec),
      thresholdTenths,
      '0x0000000000000000000000000000000000000000' as Hex, // FLR
    ],
    account: schedulerAccount,
  });

  const createTxHash = await schedulerWallet.writeContract(createRequest);
  await publicClient.waitForTransactionReceipt({ hash: createTxHash });
  console.log(`   ✅ Market created! ID: ${marketId}, TX: ${createTxHash}\n`);

  // Step 2: Wait for resolve time (with countdown)
  console.log('2️⃣ Waiting for resolve time...');
  const waitMs = (resolveTimeSec * 1000) - Date.now() + 5000; // +5s buffer
  const waitSec = Math.ceil(waitMs / 1000);
  
  for (let i = waitSec; i > 0; i--) {
    process.stdout.write(`\r   ⏳ ${i} seconds remaining...   `);
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('\n   ✅ Resolve time reached!\n');

  // Step 3: Fetch current temperature (simulated)
  console.log('3️⃣ Fetching current temperature...');
  const actualTempTenths = 600; // Simulate 60°F
  const observedTimestamp = Math.floor(Date.now() / 1000);
  console.log(`   🌡️  Actual temp: ${actualTempTenths / 10}°F`);
  console.log(`   📊 Outcome: ${actualTempTenths >= Number(thresholdTenths) ? 'YES wins' : 'NO wins'}\n`);

  // Step 4: Resolve market
  console.log('4️⃣ Resolving market...');
  const { request: resolveRequest } = await publicClient.simulateContract({
    address: CONTRACT_ADDRESS,
    abi: WEATHER_MARKET_ABI,
    functionName: 'resolveMarket',
    args: [
      marketId,
      BigInt(actualTempTenths),
      BigInt(observedTimestamp),
    ],
    account: settlerAccount,
  });

  const resolveTxHash = await settlerWallet.writeContract(resolveRequest);
  await publicClient.waitForTransactionReceipt({ hash: resolveTxHash });
  console.log(`   ✅ Market resolved! TX: ${resolveTxHash}\n`);

  // Step 5: Log to Google Sheets
  console.log('5️⃣ Logging to Google Sheets...');
  const sheetsClient = createGoogleSheetsClient();
  
  if (!sheetsClient) {
    console.log('   ⚠️  Google Sheets client not available (check env vars)\n');
  } else {
    try {
      // Fetch comparison temps
      // Convert to CST
      const cstTime = (() => {
        const date = new Date(resolveTimeSec * 1000);
        const cstDate = new Date(date.getTime() - 6 * 60 * 60 * 1000);
        return cstDate.toISOString().replace('T', ' ').slice(0, 19);
      })();

      await sheetsClient.appendRow({
        marketId: marketId.toString(),
        city: CITY.name,
        threshold: Number(thresholdTenths),
        resolvedTemp: actualTempTenths,
        primaryTemp: actualTempTenths,
        primaryProvider: 'test-script',
        altTemp1: null,
        altTemp2: null,
        altTemp3: null,
        time: cstTime,
        volume: '0.00',
      });

      console.log('   ✅ Logged to Google Sheets!\n');
    } catch (error) {
      console.log(`   ❌ Failed to log to Sheets: ${error}\n`);
    }
  }

  console.log('🎉 Test complete!');
  console.log(`   Market ID: ${marketId}`);
  console.log(`   Create TX: ${createTxHash}`);
  console.log(`   Resolve TX: ${resolveTxHash}`);
}

main().catch(console.error);
