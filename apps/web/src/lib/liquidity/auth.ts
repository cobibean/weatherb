/** Maker signing requires an explicit bearer secret even in development. */
export function verifyLiquidityWorkerRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return process.env.WEATHERB_WORKER_ROLE === 'settler' && !!secret && secret.length >= 32 &&
    request.headers.get('authorization') === `Bearer ${secret}`;
}
