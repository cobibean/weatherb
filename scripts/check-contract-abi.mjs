import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WEATHER_MARKET_ABI } from '../packages/shared/src/abi/weather-market.ts';

const artifact = JSON.parse(
  readFileSync(
    new URL('../contracts/out/WeatherMarketV2.sol/WeatherMarketV2.json', import.meta.url),
    'utf8',
  ),
);
// Internal Solidity type labels are not part of the external ABI contract.
function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== 'internalType')
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, normalize(entry)]),
    );
  }
  return value;
}
const canonical = (abi) => abi.map((entry) => JSON.stringify(normalize(entry))).sort();
assert.deepEqual(
  canonical(WEATHER_MARKET_ABI),
  canonical(artifact.abi),
  'Shared ABI differs from WeatherMarketV2. Rebuild and regenerate it before using the new deployment.',
);
console.log('Shared ABI matches the compiled WeatherMarketV2 contract.');
