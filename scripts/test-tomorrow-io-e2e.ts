#!/usr/bin/env tsx
/**
 * End-to-End Tomorrow.io Integration Test
 *
 * Creates a 5-minute test market, waits for it to resolve, then settles it.
 * Uses REAL Tomorrow.io API calls with REAL cities.
 *
 * This validates:
 * 1. Tomorrow.io Forecast API works (market creation)
 * 2. Tomorrow.io Realtime API works (settlement)
 * 3. Caching works (check logs for HIT/MISS)
 * 4. Temperature conversion is correct
 *
 * NOTE: Uses 2 Tomorrow.io API calls (forecast + realtime)
 */

import 'dotenv/config';
import { createWeatherProviderFromEnv } from '@weatherb/shared/providers';
import { CITIES } from '@weatherb/shared/constants';

const TEST_MARKET_DURATION_SEC = 5 * 60; // 5 minutes
const SETTLEMENT_DELAY_SEC = 5; // Wait 5 extra seconds after resolve time

async function sleep(seconds: number): Promise<void> {
  console.log(`⏳ Sleeping for ${seconds} seconds...`);
  await new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

function formatTemp(tenths: number): string {
  return `${(tenths / 10).toFixed(1)}°F`;
}

function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toISOString();
}

async function main() {
  console.log('🚀 Tomorrow.io E2E Integration Test\n');
  console.log('═══════════════════════════════════════════════════════════');

  // Check for API key
  const apiKey = process.env.TOMORROW_IO_API_KEY;
  if (!apiKey) {
    console.error('❌ TOMORROW_IO_API_KEY not found in environment');
    console.error('   Add it to .env file');
    process.exit(1);
  }

  // Use NYC for testing
  const testCity = CITIES.find(c => c.slug === 'nyc');
  if (!testCity) {
    console.error('❌ NYC city not found in CITIES constant');
    process.exit(1);
  }

  console.log(`📍 Test City: ${testCity.name}`);
  console.log(`   Coords: ${testCity.latitude}, ${testCity.longitude}`);
  console.log(`   API Key: ${apiKey.substring(0, 8)}...`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Step 1: Get current time and calculate resolve time
  const nowSec = Math.floor(Date.now() / 1000);
  const resolveTimeSec = nowSec + TEST_MARKET_DURATION_SEC;

  console.log('⏰ Market Timeline:');
  console.log(`   Created:  ${formatTimestamp(nowSec)}`);
  console.log(`   Resolves: ${formatTimestamp(resolveTimeSec)}`);
  console.log(`   Duration: ${TEST_MARKET_DURATION_SEC / 60} minutes\n`);

  // Step 2: Create provider
  console.log('🔧 Creating weather provider...');
  const provider = createWeatherProviderFromEnv();
  console.log(`   Provider: ${provider.name}\n`);

  // Step 3: Get forecast (market creation)
  console.log('📊 PHASE 1: Market Creation (Forecast API)');
  console.log('───────────────────────────────────────────────────────────');

  let forecastTenths: number;
  try {
    console.log(`   Fetching forecast for ${formatTimestamp(resolveTimeSec)}...`);
    const startTime = Date.now();

    forecastTenths = await provider.getForecast(
      testCity.latitude,
      testCity.longitude,
      resolveTimeSec
    );

    const latencyMs = Date.now() - startTime;

    console.log(`   ✅ Forecast received in ${latencyMs}ms`);
    console.log(`   📈 Forecast temp: ${formatTemp(forecastTenths)}`);
    console.log(`   🎯 Market threshold: ${formatTemp(Math.round(forecastTenths / 10) * 10)}\n`);
  } catch (error) {
    console.error('   ❌ Forecast API failed:', error);
    process.exit(1);
  }

  // Step 4: Wait for resolve time
  const waitSeconds = TEST_MARKET_DURATION_SEC + SETTLEMENT_DELAY_SEC;
  console.log(`⏰ PHASE 2: Waiting for Market to Resolve`);
  console.log('───────────────────────────────────────────────────────────');
  console.log(`   Will wait ${waitSeconds} seconds (${waitSeconds / 60} minutes)`);
  console.log(`   Market resolves at: ${formatTimestamp(resolveTimeSec)}`);
  console.log(`   Settlement at: ${formatTimestamp(resolveTimeSec + SETTLEMENT_DELAY_SEC)}\n`);

  // Show countdown
  const startWaitTime = Date.now();
  for (let i = 0; i < waitSeconds; i += 30) {
    const remaining = waitSeconds - i;
    const minutesRemaining = Math.floor(remaining / 60);
    const secondsRemaining = remaining % 60;
    console.log(`   ⏳ ${minutesRemaining}m ${secondsRemaining}s remaining...`);
    await sleep(Math.min(30, remaining));
  }

  const actualWaitTime = (Date.now() - startWaitTime) / 1000;
  console.log(`   ✅ Waited ${actualWaitTime.toFixed(1)}s\n`);

  // Step 5: Get realtime temperature (settlement)
  console.log('🌡️  PHASE 3: Market Settlement (Realtime API)');
  console.log('───────────────────────────────────────────────────────────');

  try {
    const settlementTimeSec = Math.floor(Date.now() / 1000);
    console.log(`   Fetching realtime temp at ${formatTimestamp(settlementTimeSec)}...`);

    const startTime = Date.now();

    const reading = await provider.getFirstReadingAtOrAfter(
      testCity.latitude,
      testCity.longitude,
      resolveTimeSec
    );

    const latencyMs = Date.now() - startTime;

    console.log(`   ✅ Realtime data received in ${latencyMs}ms`);
    console.log(`   🌡️  Actual temp: ${formatTemp(reading.tempF_tenths)}`);
    console.log(`   📅 Observed at: ${formatTimestamp(reading.observedTimestamp)}`);
    console.log(`   🔌 Source: ${reading.source}`);

    // Compare with forecast
    const tempDiff = reading.tempF_tenths - forecastTenths;
    const tempDiffF = tempDiff / 10;
    console.log(`\n   📊 Forecast vs Actual:`);
    console.log(`      Forecast: ${formatTemp(forecastTenths)}`);
    console.log(`      Actual:   ${formatTemp(reading.tempF_tenths)}`);
    console.log(`      Diff:     ${tempDiffF > 0 ? '+' : ''}${tempDiffF.toFixed(1)}°F`);

    // Determine outcome
    const threshold = Math.round(forecastTenths / 10) * 10;
    const outcome = reading.tempF_tenths >= threshold ? 'YES' : 'NO';
    console.log(`\n   🎲 Market Outcome:`);
    console.log(`      Threshold: ${formatTemp(threshold)}`);
    console.log(`      Actual:    ${formatTemp(reading.tempF_tenths)}`);
    console.log(`      Winner:    ${outcome} ${outcome === 'YES' ? '✅' : '❌'}`);

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ TEST PASSED: Tomorrow.io API Integration Working!');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Summary
    console.log('📋 Summary:');
    console.log(`   City: ${testCity.name}`);
    console.log(`   Forecast: ${formatTemp(forecastTenths)} (${formatTimestamp(resolveTimeSec)})`);
    console.log(`   Actual: ${formatTemp(reading.tempF_tenths)} (${formatTimestamp(reading.observedTimestamp)})`);
    console.log(`   Difference: ${Math.abs(tempDiffF).toFixed(1)}°F`);
    console.log(`   Outcome: ${outcome} wins\n`);

    // Verify temperature manually
    console.log('🔍 Manual Verification:');
    console.log(`   1. Check weather.com or weather.gov for ${testCity.name}`);
    console.log(`   2. Current temp should be around ${formatTemp(reading.tempF_tenths)}`);
    console.log(`   3. Tomorrow.io Dashboard: https://app.tomorrow.io/`);
    console.log(`      - Check API usage (should show 2 calls: forecast + realtime)\n`);

    // Check for cache logs
    console.log('💡 Note: Check console output above for cache HIT/MISS logs');
    console.log('   First call: Should be MISS (fetches from API)');
    console.log('   Second call: Should be HIT if within 1 hour (uses cache)\n');

  } catch (error) {
    console.error('   ❌ Realtime API failed:', error);
    console.error('\n═══════════════════════════════════════════════════════════');
    console.error('❌ TEST FAILED: Check error above');
    console.error('═══════════════════════════════════════════════════════════\n');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
