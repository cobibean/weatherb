import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const artifact = JSON.parse(readFileSync(new URL('contracts/out/WeatherMarketV2.sol/WeatherMarketV2.json', root), 'utf8'));
const source = readFileSync(new URL('contracts/src/WeatherMarketV2.sol', root), 'utf8');
const version = /return "(\d+\.\d+\.\d+)";/.exec(source)?.[1];
if (!version) throw new Error('Could not read version() from WeatherMarketV2.sol');
const body = JSON.stringify(artifact.abi, null, 2).replace(/"([a-zA-Z_]+)":/g, '$1:').replace(/"/g, "'");
writeFileSync(
  new URL('packages/shared/src/abi/weather-market.ts', root),
  `// Generated from contracts/out/WeatherMarketV2.sol/WeatherMarketV2.json by scripts/generate-contract-abi.mjs.\n// Intended source version: ${version}; this does not upgrade any deployed contract.\nexport const WEATHER_MARKET_ABI = ${body} as const;\n`,
);
console.log(`Shared ABI regenerated for ${version} (${artifact.abi.length} entries).`);
