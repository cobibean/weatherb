/** Versions of WeatherMarketV2 the Arc restart automation may operate against. */
export const SUPPORTED_CONTRACT_VERSIONS = ['2.2.0', '2.3.0'] as const;
export const CURRENT_CONTRACT_VERSION = '2.3.0';
export function isSupportedContractVersion(version: string): boolean {
  return (SUPPORTED_CONTRACT_VERSIONS as readonly string[]).includes(version);
}
