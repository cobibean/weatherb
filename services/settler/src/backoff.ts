export function exponentialBackoffMs(attempt: number, baseDelayMs: number): number {
  if (attempt < 1) return 0;
  return baseDelayMs * 2 ** (attempt - 1);
}
