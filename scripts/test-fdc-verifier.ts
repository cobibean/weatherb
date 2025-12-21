#!/usr/bin/env npx tsx
/**
 * Test FDC Verifier Connection
 *
 * This script tests connectivity to the Flare JQ Verifier for Web2Json attestations.
 * It prepares an attestation request using MET Norway weather data.
 *
 * Usage:
 *   npx tsx scripts/test-fdc-verifier.ts
 */

import axios from 'axios';
import { keccak256, toBytes } from 'viem';

// Coston2 testnet verifier URL (use /verifier/flr/ for Flare chain)
const COSTON2_VERIFIER_URL = 'https://fdc-verifiers-testnet.flare.network/verifier/flr';
const PUBLIC_API_KEY = '00000000-0000-0000-0000-000000000000';

// Attestation type constants
// Note: "JsonApi" is the attestation type name (IJsonApi interface), Web2Json is the attestation class
const JSONAPI_ATTESTATION_TYPE = '0x494a736f6e417069000000000000000000000000000000000000000000000000'; // "IJsonApi"
const WEB2_SOURCE_ID = '0x5745423200000000000000000000000000000000000000000000000000000000'; // "WEB2"

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  FDC Verifier Connection Test (Coston2)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();

  // Test city: NYC
  const city = {
    id: 'nyc',
    latitude: 40.7128,
    longitude: -74.006,
  };
  const cityIdBytes32 = keccak256(toBytes(city.id));

  console.log(`📍 City: ${city.id} → ${cityIdBytes32}`);
  console.log(`📍 Coordinates: ${city.latitude}, ${city.longitude}`);
  console.log(`📍 Verifier: ${COSTON2_VERIFIER_URL}`);
  console.log();

  // Step 1: Test MET Norway API directly
  console.log('───────────────────────────────────────────────────────────────');
  console.log('  Step 1: Test MET Norway API');
  console.log('───────────────────────────────────────────────────────────────');

  const metNoUrl = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${city.latitude}&lon=${city.longitude}`;
  console.log(`   URL: ${metNoUrl}`);

  try {
    const metResponse = await axios.get(metNoUrl, {
      headers: { 'User-Agent': 'WeatherB/1.0 (test@weatherb.app)' },
    });

    const firstTimeseries = metResponse.data.properties.timeseries[0];
    const tempC = firstTimeseries.data.instant.details.air_temperature;
    const tempF = (tempC * 9) / 5 + 32;
    const tempFTenths = Math.floor(tempF * 10);

    console.log(`   ✅ MET Norway API working!`);
    console.log(`   Time: ${firstTimeseries.time}`);
    console.log(`   Temperature: ${tempC}°C = ${tempF.toFixed(1)}°F = ${tempFTenths} tenths`);
  } catch (error) {
    console.log(`   ❌ MET Norway API failed: ${error}`);
    process.exit(1);
  }

  console.log();

  // Step 2: Prepare attestation request
  console.log('───────────────────────────────────────────────────────────────');
  console.log('  Step 2: Prepare Web2Json Attestation Request');
  console.log('───────────────────────────────────────────────────────────────');

  // JQ filter to extract and transform temperature
  const postProcessJq = `.properties.timeseries[0] | { cityId: "${cityIdBytes32}", observedTimestamp: (.time | fromdateiso8601), tempTenths: ((.data.instant.details.air_temperature * 10 | floor) * 18 / 10 + 320 | floor) }`;

  const requestBody = {
    url: metNoUrl,
    httpMethod: 'GET',
    headers: JSON.stringify({ 'User-Agent': 'WeatherB/1.0 (FDC-Attestation)' }),
    queryParams: '{}',
    body: '{}',
    postProcessJq,
    abiSignature: '(bytes32 cityId, uint64 observedTimestamp, uint256 tempTenths)',
  };

  console.log(`   Attestation Type: Web2Json`);
  console.log(`   Source ID: WEB2`);
  console.log(`   JQ Filter: ${postProcessJq.slice(0, 60)}...`);
  console.log(`   ABI Signature: ${requestBody.abiSignature}`);
  console.log();

  // Step 3: Send to verifier
  console.log('───────────────────────────────────────────────────────────────');
  console.log('  Step 3: Send to FDC Verifier');
  console.log('───────────────────────────────────────────────────────────────');

  const payload = {
    attestationType: JSONAPI_ATTESTATION_TYPE,
    sourceId: WEB2_SOURCE_ID,
    requestBody: requestBody, // Not stringified - the verifier expects an object
  };

  console.log(`   Sending to: ${COSTON2_VERIFIER_URL}/JsonApi/prepareRequest`);

  try {
    const verifierResponse = await axios.post(
      `${COSTON2_VERIFIER_URL}/JsonApi/prepareRequest`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': PUBLIC_API_KEY,
        },
        timeout: 30000,
      },
    );

    console.log(`   ✅ Verifier responded!`);
    console.log(`   Status: ${verifierResponse.status}`);

    if (verifierResponse.data.abiEncodedRequest) {
      const encoded = verifierResponse.data.abiEncodedRequest;
      console.log(`   abiEncodedRequest: ${encoded.slice(0, 66)}...`);
      console.log(`   Length: ${encoded.length} chars`);
      console.log();
      console.log('   ✅ SUCCESS! The verifier prepared the attestation request.');
      console.log('   Next step: Submit this to FdcHub contract on-chain.');
    } else {
      console.log(`   Response:`, JSON.stringify(verifierResponse.data, null, 2));
    }
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.log(`   ❌ Verifier request failed!`);
      console.log(`   Status: ${error.response?.status}`);
      console.log(`   Error: ${error.response?.data?.error || error.message}`);
      if (error.response?.data) {
        console.log(`   Response:`, JSON.stringify(error.response.data, null, 2));
      }
    } else {
      console.log(`   ❌ Error: ${error}`);
    }
  }

  console.log();
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Test Complete');
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

