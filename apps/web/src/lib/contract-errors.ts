/**
 * WeatherMarket Contract Error Decoder
 * Maps Solidity custom error selectors to user-friendly messages
 */

// Error selectors (first 4 bytes of keccak256 hash of error signature)
const ERROR_SELECTORS: Record<string, { name: string; message: string }> = {
  '0xa820742e': { name: 'AlreadyBet', message: 'You have already placed a bet on this market. Each wallet can only bet once per market.' },
  '0x9a8a0592': { name: 'NotOwner', message: 'Only the contract owner can perform this action.' },
  '0xa7ee4120': { name: 'NotSettler', message: 'Only the settler can perform this action.' },
  '0x4f8afbfa': { name: 'Paused', message: 'The contract is currently paused.' },
  '0x2d0a3f8e': { name: 'InvalidMarket', message: 'This market does not exist.' },
  '0x3a81d6fc': { name: 'InvalidStatus', message: 'This market is not in the correct status for this action.' },
  '0x2ef5f21e': { name: 'BettingClosed', message: 'Betting is closed for this market. Betting closes 10 minutes before the resolve time.' },
  '0x6d8e7e4d': { name: 'BetTooSmall', message: 'Your bet amount is too small. Minimum bet is 0.01 FLR.' },
  '0xb5cf5b8f': { name: 'TooEarly', message: 'It is too early to perform this action.' },
  '0x63e5d7cb': { name: 'OnlyNativeCurrency', message: 'Only native currency (FLR) is supported.' },
  '0x90b8ec18': { name: 'TransferFailed', message: 'Token transfer failed.' },
  '0xd0b87c7b': { name: 'NotResolved', message: 'This market has not been resolved yet.' },
  '0xf766b01c': { name: 'NotCancelled', message: 'This market has not been cancelled.' },
  '0x0c3b563c': { name: 'NothingToClaim', message: 'You have nothing to claim from this market.' },
  '0xa86b6512': { name: 'InvalidParams', message: 'Invalid parameters provided.' },
  '0xd92e233d': { name: 'ZeroAddress', message: 'Cannot use zero address.' },
};

/**
 * Decodes a contract error and returns a user-friendly message
 */
export function decodeContractError(error: unknown): string {
  if (!error) return 'An unknown error occurred';
  
  const errorString = error instanceof Error ? error.message : String(error);
  
  // Try to find error selector in the error message
  for (const [selector, { message }] of Object.entries(ERROR_SELECTORS)) {
    if (errorString.includes(selector)) {
      return message;
    }
  }
  
  // Check for common error patterns
  if (errorString.includes('user rejected') || errorString.includes('User rejected')) {
    return 'Transaction was cancelled by user.';
  }
  
  if (errorString.includes('insufficient funds')) {
    return 'Insufficient funds to complete this transaction.';
  }
  
  if (errorString.includes('execution reverted')) {
    // Try to extract any additional info
    const revertMatch = errorString.match(/execution reverted[:\s]*(.+?)(?:\n|$)/i);
    if (revertMatch?.[1] && revertMatch[1].length < 100) {
      return `Transaction reverted: ${revertMatch[1]}`;
    }
    return 'Transaction was reverted by the contract.';
  }
  
  // If we can't decode, return a truncated version of the error
  if (errorString.length > 150) {
    return errorString.substring(0, 147) + '...';
  }
  
  return errorString;
}

/**
 * Check if an error indicates the user has already bet on this market
 */
export function isAlreadyBetError(error: unknown): boolean {
  const errorString = error instanceof Error ? error.message : String(error);
  return errorString.includes('0xa820742e') || errorString.toLowerCase().includes('alreadybet');
}
