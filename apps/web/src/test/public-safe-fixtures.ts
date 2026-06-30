import type { Hex } from 'viem';

export function testPrivateKey(nibble: string): Hex {
  if (!/^[0-9a-f]$/i.test(nibble)) {
    throw new Error('testPrivateKey expects one hex nibble');
  }
  return `0x${nibble.repeat(64)}` as Hex;
}

export const TEST_PRIVATE_KEY_A = testPrivateKey('a');
export const TEST_PRIVATE_KEY_1 = testPrivateKey('1');
export const TEST_PRIVATE_KEY_2 = testPrivateKey('2');
export const TEST_PRIVATE_KEY_3 = testPrivateKey('3');
export const TEST_HEX_SECRET = '01'.repeat(32);
