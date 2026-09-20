/** Notify mounted position consumers only after a successful on-chain receipt. */
export const POSITIONS_UPDATED = 'weatherb:positions-updated';

export function notifyPositionsUpdated(walletAddress: string): void {
  window.dispatchEvent(new CustomEvent(POSITIONS_UPDATED, { detail: walletAddress }));
}
