/** Deliberate Arc-only acceptance operations. Never loaded by ordinary verification. */
import {
  existsSync,
  readFileSync,
  writeFileSync,
  statSync,
  renameSync,
  openSync,
  closeSync,
  rmSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  keccak256,
  toBytes,
  zeroAddress,
  formatEther,
  type Hex,
  type Abi,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  ARC_TESTNET,
  assertArcChain,
  parseNativeUsdc,
  arcTransactionUrl,
} from '@weatherb/shared/constants';
import { WEATHER_MARKET_ABI as abi } from '@weatherb/shared/abi';
import { createWeatherProviderFromEnv } from '@weatherb/shared/providers';
import prisma from '../lib/prisma';
import {
  requireRestartContract,
  reconcileMarkets,
  readMarket,
  persistMarket,
} from '../lib/cron/market-state';
import { settleMarket } from '../lib/cron/settlement';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const dir = `${root}.tools/arc-lifecycle`;
const walletFile = `${dir}/wallets.json`;
if (statSync(walletFile).mode & 0o077) throw new Error('Test wallet file must have mode 0600.');
const saved = JSON.parse(readFileSync(walletFile, 'utf8')) as {
  chainId: number;
  wallets: Record<string, { address: Hex; privateKey: Hex }>;
};
assertArcChain(saved.chainId);
const publicClient = createPublicClient({
  chain: ARC_TESTNET,
  transport: http(ARC_TESTNET.rpcUrls.default.http[0]),
});
const wallet = (role: string) => {
  const entry = saved.wallets[role];
  if (!entry) throw new Error('Unknown test wallet role.');
  const account = privateKeyToAccount(entry.privateKey);
  if (account.address !== entry.address) throw new Error('Test wallet address mismatch.');
  return createWalletClient({ chain: ARC_TESTNET, account, transport: http() });
};
const journalFile = `${dir}/journal.json`;
type Journal = {
  pendingSubmission?: string;
  chainId: number;
  hostedSettler?: Hex;
  hostedScheduler?: Hex;
  implementation?: Hex;
  implementations?: { version: string; address: Hex; transaction: Hex }[];
  proxy?: Hex;
  build?: string;
  transactions: Record<string, Hex>;
  markets: Record<string, string>;
  claims: Record<string, { expected: string; actual: string; gas: string }>;
};
const journal: Journal = existsSync(journalFile)
  ? JSON.parse(readFileSync(journalFile, 'utf8'))
  : { chainId: ARC_TESTNET.id, transactions: {}, markets: {}, claims: {} };
assertArcChain(journal.chainId);
function save() {
  writeFileSync(`${journalFile}.tmp`, JSON.stringify(journal, null, 2), { mode: 0o600 });
  renameSync(`${journalFile}.tmp`, journalFile);
}
async function receipt(label: string, submit: () => Promise<Hex>) {
  let hash = journal.transactions[label];
  if (!hash) {
    if (journal.pendingSubmission)
      throw new Error(
        `Uncertain submission ${journal.pendingSubmission}; check on-chain history before clearing the pending marker.`,
      );
    journal.pendingSubmission = label;
    save();
    hash = await submit();
    journal.transactions[label] = hash;
    delete journal.pendingSubmission;
    save();
  }
  const result = await publicClient.waitForTransactionReceipt({ hash });
  if (result.status !== 'success')
    throw new Error(`Reverted ${label}; inspect journal before retry.`);
  console.log(`${label}: ${arcTransactionUrl(hash)}`);
  return result;
}
function address(): Hex {
  if (
    !journal.proxy ||
    journal.proxy.toLowerCase() !== process.env.NEXT_PUBLIC_CONTRACT_ADDRESS?.toLowerCase()
  )
    throw new Error('Local profile and deployment journal must agree before any contract action.');
  return journal.proxy;
}
async function requireDeployment() {
  const target = address();
  await requireRestartContract(publicClient, target);
  const [owner, settler] = await Promise.all(
    ['owner', 'settler'].map((functionName) =>
      publicClient.readContract({
        address: target,
        abi,
        functionName: functionName as 'owner' | 'settler',
      }),
    ),
  );
  if (
    owner?.toLowerCase() !== saved.wallets.owner!.address.toLowerCase() ||
    settler?.toLowerCase() !== (journal.hostedSettler ?? saved.wallets.settler!.address).toLowerCase()
  )
    throw new Error('Deployment roles do not match the fresh test wallets.');
  return target;
}
async function send(
  label: string,
  role: string,
  functionName: 'placeBet' | 'claim' | 'cancelMarket' | 'createMarket' | 'createScheduledMarket' | 'setSettler' | 'setScheduler' | 'upgradeToAndCall',
  args: readonly unknown[],
  value = 0n,
) {
  const address = await requireDeployment();
  const signer = wallet(role);
  return receipt(label, async () => {
    const { request } = await publicClient.simulateContract({
      address,
      abi: abi as Abi,
      functionName,
      args,
      account: signer.account,
      value,
    });
    return signer.writeContract(request);
  });
}
async function verifyImplementationBytecode(implementation: Hex, artifact: { deployedBytecode: { object: string; immutableReferences: Record<string, { start: number; length: number }[]> } }) {
  const code = await publicClient.getCode({ address: implementation });
  let expectedCode: string = artifact.deployedBytecode.object;
  // UUPS embeds its implementation address in three immutable __self slots.
  for (const refs of Object.values(artifact.deployedBytecode.immutableReferences)) {
    for (const ref of refs) {
      const start = 2 + ref.start * 2;
      expectedCode = expectedCode.slice(0, start) + implementation.slice(2).toLowerCase().padStart(ref.length * 2, '0') + expectedCode.slice(start + ref.length * 2);
    }
  }
  if (code?.toLowerCase() !== expectedCode.toLowerCase()) throw new Error('Implementation bytecode does not match the local build.');
}
async function snapshotState(target: Hex) {
  const read = <N extends 'owner' | 'settler' | 'feeBps' | 'minBetWei' | 'bettingBufferSeconds' | 'isPaused' | 'getMarketCount'>(functionName: N) =>
    publicClient.readContract({ address: target, abi, functionName });
  const [owner, settler, feeBps, minBetWei, buffer, paused, count] = await Promise.all([
    read('owner'), read('settler'), read('feeBps'), read('minBetWei'), read('bettingBufferSeconds'), read('isPaused'), read('getMarketCount'),
  ]);
  const markets = [];
  for (let id = 0n; id < count; id++) markets.push(await readMarket(publicClient, target, id));
  const slots = markets.map((m) => BigInt(Math.floor((Number(m.resolveTime) - 86400) / 3600) * 3600));
  const scheduled = await Promise.all(slots.map((slot) => publicClient.readContract({ address: target, abi, functionName: 'getScheduledMarket', args: [slot] })));
  return JSON.stringify({ owner, settler, feeBps, minBetWei, buffer, paused, count, markets, scheduled }, (_, v) => (typeof v === 'bigint' ? v.toString() : v));
}
async function create(label: string, scheduled: boolean) {
  if (journal.markets[label]) return BigInt(journal.markets[label]);
  const target = await requireDeployment();
  const city = await prisma.city.findUniqueOrThrow({ where: { slug: 'austin' } });
  const block = await publicClient.getBlock();
  const hour = Number((block.timestamp % 86400n) / 3600n);
  if (scheduled && !journal.transactions[`create-${label}`] && (hour < 12 || hour > 16))
    throw new Error('Start the 24-hour market between 12:00 and 16:59 UTC.');
  // A short, explicitly manual fixture lets browser acceptance run independently
  // of the scheduled 24-hour market. The deployed production rules are unchanged.
  const resolveTime = Number(block.timestamp) + (label === 'browser-test' || label.startsWith('hosted-test-') ? 1800 : 86400);
  const forecast = await createWeatherProviderFromEnv().getForecast(
    city.latitude,
    city.longitude,
    resolveTime,
  );
  const threshold = label === 'no-winners' ? 10000 : Math.round(forecast / 10) * 10;
  if (!Number.isSafeInteger(threshold) || threshold <= 0)
    throw new Error('Weather forecast is not supported.');
  const args = scheduled
    ? [keccak256(toBytes(city.slug)), BigInt(threshold), (block.timestamp / 3600n) * 3600n]
    : [keccak256(toBytes(city.slug)), BigInt(resolveTime), BigInt(threshold), zeroAddress];
  const result = await send(
    `create-${label}`,
    'owner',
    scheduled ? 'createScheduledMarket' : 'createMarket',
    args,
  );
  // Recover the actual emitted ID; never infer it from a pre-transaction count.
  const { parseEventLogs } = await import('viem');
  const logs = parseEventLogs({ abi, logs: result.logs, eventName: 'MarketCreated' });
  const id = logs.find((log) => log.address.toLowerCase() === target.toLowerCase())?.args.marketId;
  if (id === undefined) throw new Error('Creation receipt has no market ID.');
  journal.markets[label] = id.toString();
  save();
  const market = await readMarket(publicClient, target, id);
  await persistMarket(id, market);
  console.log(
    JSON.stringify({
      label,
      marketId: id.toString(),
      resolveAt: new Date(Number(market.resolveTime) * 1000).toISOString(),
      duration: Number(
        market.resolveTime -
          (await publicClient.getBlock({ blockNumber: result.blockNumber })).timestamp,
      ),
    }),
  );
  return id;
}
async function claim(label: string, role: string, id: bigint) {
  if (journal.claims[label]) return;
  const target = await requireDeployment();
  if (journal.transactions[label])
    throw new Error(
      'Claim receipt exists without balance evidence; reconcile manually before retry.',
    );
  const bettor = saved.wallets[role]!.address;
  const expected = await publicClient.readContract({
    address: target,
    abi,
    functionName: 'calculatePayout',
    args: [id, bettor],
  });
  const before = await publicClient.getBalance({ address: bettor });
  const result = await send(label, role, 'claim', [id]);
  const after = await publicClient.getBalance({ address: bettor, blockNumber: result.blockNumber });
  const gas = result.gasUsed * result.effectiveGasPrice;
  const actual = after - before + gas;
  journal.claims[label] = {
    expected: expected.toString(),
    actual: actual.toString(),
    gas: gas.toString(),
  };
  save();
  if (actual !== expected) throw new Error('Claim balance reconciliation failed.');
  console.log(`${label}: received ${formatEther(actual)} USDC, excluding gas`);
}
async function main() {
  assertArcChain(await publicClient.getChainId());
  const command = process.argv[2] ?? 'status';
  if (command === 'status') {
    for (const [role, entry] of Object.entries(saved.wallets))
      console.log(
        `${role} ${entry.address}: ${formatEther(await publicClient.getBalance({ address: entry.address }))} test USDC`,
      );
    let version: string | null = null;
    let scheduler: string | null = null;
    if (journal.proxy) {
      version = await publicClient.readContract({ address: journal.proxy, abi, functionName: 'version' });
      if (version !== '2.2.0')
        scheduler = await publicClient.readContract({ address: journal.proxy, abi, functionName: 'scheduler' });
    }
    console.log(
      JSON.stringify({
        chainId: ARC_TESTNET.id,
        proxy: journal.proxy ?? null,
        version,
        scheduler,
        hostedScheduler: journal.hostedScheduler ?? null,
        markets: journal.markets,
      }),
    );
  } else if (command === 'weather') {
    const forecast = await createWeatherProviderFromEnv().getForecast(
      30.2672,
      -97.7431,
      Math.floor(Date.now() / 1000) + 86400,
    );
    console.log(
      JSON.stringify({ provider: 'Tomorrow.io', city: 'Austin', forecastTenthsF: forecast }),
    );
  } else if (command === 'deploy') {
    if ((await prisma.market.count()) > 0 && !journal.proxy)
      throw new Error('Deploy requires an empty development database.');
    const source = readFileSync(
      `${root}contracts/out/WeatherMarketV2.sol/WeatherMarketV2.json`,
      'utf8',
    );
    const build = createHash('sha256').update(source).digest('hex');
    if (journal.build && journal.build !== build)
      throw new Error('Build changed after deployment began.');
    journal.build = build;
    save();
    const artifact = JSON.parse(source);
    const signer = wallet('owner');
    const implementationReceipt = await receipt('deploy-implementation', () =>
      signer.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode.object }),
    );
    journal.implementation = implementationReceipt.contractAddress!;
    save();
    const proxy = JSON.parse(
      readFileSync(`${root}contracts/out/ERC1967Proxy.sol/ERC1967Proxy.json`, 'utf8'),
    );
    const init = encodeFunctionData({
      abi,
      functionName: 'initialize',
      args: [signer.account.address, saved.wallets.settler!.address],
    });
    const proxyReceipt = await receipt('deploy-proxy', () =>
      signer.deployContract({
        abi: proxy.abi,
        bytecode: proxy.bytecode.object,
        args: [journal.implementation, init],
      }),
    );
    journal.proxy = proxyReceipt.contractAddress!;
    save();
    await verifyImplementationBytecode(journal.implementation!, artifact);
    console.log(
      `Fresh Arc proxy: ${journal.proxy}. Run npm run arc:configure to bind this address into the dev profile.`,
    );
  } else if (command === 'fund') {
    const signer = wallet('owner');
    for (const role of ['settler', 'yesBettor', 'noBettor']) {
      const to = saved.wallets[role]!.address;
      await receipt(`fund-${role}`, () =>
        signer.sendTransaction({ to, value: parseNativeUsdc('2') }),
      );
    }
  } else if (command === 'reconcile') {
    console.log(await reconcileMarkets(publicClient, await requireDeployment()));
  } else if (command === 'cancel-test') {
    const id = await create('cancellation', false);
    await send('cancel-yes-bet', 'yesBettor', 'placeBet', [id, true], parseNativeUsdc('0.02'));
    await send(
      'cancel-both-side-bet',
      'yesBettor',
      'placeBet',
      [id, false],
      parseNativeUsdc('0.01'),
    );
    await send('cancel-no-bet', 'noBettor', 'placeBet', [id, false], parseNativeUsdc('0.02'));
    await send('cancel-market', 'owner', 'cancelMarket', [id]);
    await persistMarket(id, await readMarket(publicClient, address(), id));
    await claim('cancel-yes-refund', 'yesBettor', id);
    await claim('cancel-no-refund', 'noBettor', id);
  } else if (command === 'start') {
    const id = await create('core', true);
    await send('core-yes-bet', 'yesBettor', 'placeBet', [id, true], parseNativeUsdc('0.02'));
    await send('core-repeat-bet', 'yesBettor', 'placeBet', [id, true], parseNativeUsdc('0.01'));
    await send('core-no-bet', 'noBettor', 'placeBet', [id, false], parseNativeUsdc('0.02'));
    await persistMarket(id, await readMarket(publicClient, address(), id));
  } else if (command === 'browser-test') {
    const id = await create('browser-test', false);
    await send('browser-test-yes', 'yesBettor', 'placeBet', [id, true], parseNativeUsdc('0.01'));
    await send('browser-test-no', 'noBettor', 'placeBet', [id, false], parseNativeUsdc('0.01'));
    await persistMarket(id, await readMarket(publicClient, address(), id));
  } else if (command === 'no-winners') {
    const id = await create('no-winners', false);
    await send('no-winners-yes-bet', 'yesBettor', 'placeBet', [id, true], parseNativeUsdc('0.01'));
    await persistMarket(id, await readMarket(publicClient, address(), id));
  } else if (command === 'settle') {
    if (journal.hostedSettler) throw new Error('Settlement is owned by the hosted worker; use the Operations page.');
    const target = await requireDeployment();
    const ids = await reconcileMarkets(publicClient, target);
    const before = await prisma.systemConfig.findUniqueOrThrow({ where: { id: 'default' } });
    // Only this explicit command opens the local settler gate; always restore it.
    try {
      await prisma.systemConfig.update({
        where: { id: 'default' },
        data: { settlerPaused: false },
      });
      for (const id of ids)
        console.log(
          await settleMarket({ publicClient, walletClient: wallet('settler') }, target, id),
        );
    } finally {
      await prisma.systemConfig.update({
        where: { id: 'default' },
        data: { settlerPaused: before.settlerPaused },
      });
    }
  } else if (command === 'claims') {
    const target = await requireDeployment();
    for (const [label, raw] of Object.entries(journal.markets)) {
      if (label === 'cancellation') continue;
      const id = BigInt(raw);
      for (const role of ['yesBettor', 'noBettor']) {
        const payout = await publicClient.readContract({
          address: target,
          abi,
          functionName: 'calculatePayout',
          args: [id, saved.wallets[role]!.address],
        });
        if (payout > 0n) await claim(`${label}-${role}-claim`, role, id);
      }
    }
  } else if (command === 'rotate-settler') {
    const file = `${root}.tools/arc-hosted/settler.json`;
    if (statSync(file).mode & 0o077) throw new Error('Hosted settler file must have mode 0600.');
    const hosted = JSON.parse(readFileSync(file, 'utf8')) as { chainId: number; address: Hex };
    assertArcChain(hosted.chainId);
    if (journal.hostedSettler && journal.hostedSettler.toLowerCase() !== hosted.address.toLowerCase())
      throw new Error('Journal already records a different hosted settler.');
    const target = await requireDeployment(); // Passes while the local settler is still active.
    await send('rotate-settler', 'owner', 'setSettler', [hosted.address]);
    journal.hostedSettler = hosted.address;
    save();
    const current = await publicClient.readContract({ address: target, abi, functionName: 'settler' });
    if (current.toLowerCase() !== hosted.address.toLowerCase()) throw new Error('Settler rotation not confirmed.');
    console.log(`settler is now hosted ${hosted.address}; local settlement is disabled.`);
  } else if (command === 'fund-hosted-settler') {
    if (!journal.hostedSettler) throw new Error('Run rotate-settler first.');
    const signer = wallet('owner');
    const to = journal.hostedSettler;
    await receipt('fund-hosted-settler', () => signer.sendTransaction({ to, value: parseNativeUsdc('2') }));
    console.log(`hosted settler balance: ${formatEther(await publicClient.getBalance({ address: to }))} USDC`);
  } else if (command === 'hosted-test') {
    const suffix = process.argv[3];
    if (!/^[a-z0-9-]{1,20}$/.test(suffix ?? '')) throw new Error('Use hosted-test <label>');
    const id = await create(`hosted-test-${suffix}`, false);
    await send(`hosted-test-${suffix}-yes`, 'yesBettor', 'placeBet', [id, true], parseNativeUsdc('0.01'));
    await send(`hosted-test-${suffix}-no`, 'noBettor', 'placeBet', [id, false], parseNativeUsdc('0.01'));
    await persistMarket(id, await readMarket(publicClient, address(), id));
  } else if (command === 'upgrade') {
    const target = await requireDeployment();
    const source = readFileSync(`${root}contracts/out/WeatherMarketV2.sol/WeatherMarketV2.json`, 'utf8');
    const artifact = JSON.parse(source);
    const expectedVersion = /return "(\d+\.\d+\.\d+)";/.exec(readFileSync(`${root}contracts/src/WeatherMarketV2.sol`, 'utf8'))![1]!;
    const before = await snapshotState(target);
    const currentVersion = await publicClient.readContract({ address: target, abi, functionName: 'version' });
    if (currentVersion === expectedVersion) throw new Error(`Proxy already reports ${expectedVersion}.`);
    const signer = wallet('owner');
    const implementationReceipt = await receipt('upgrade-implementation', () =>
      signer.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode.object }),
    );
    const implementation = implementationReceipt.contractAddress!;
    await verifyImplementationBytecode(implementation, artifact);
    const upgradeReceipt = await send('upgrade-proxy', 'owner', 'upgradeToAndCall', [implementation, '0x']);
    const after = await snapshotState(target);
    if (after !== before) throw new Error('State snapshot changed across the upgrade; investigate before continuing.');
    const version = await publicClient.readContract({ address: target, abi, functionName: 'version' });
    if (version !== expectedVersion) throw new Error(`Upgrade did not produce ${expectedVersion} (got ${version}).`);
    journal.implementation = implementation;
    journal.build = createHash('sha256').update(source).digest('hex');
    (journal.implementations ??= []).push({ version, address: implementation, transaction: upgradeReceipt.transactionHash });
    save();
    console.log(`proxy ${target} now runs ${version} at implementation ${implementation}`);
  } else if (command === 'set-scheduler') {
    const file = `${root}.tools/arc-hosted/scheduler.json`;
    if (statSync(file).mode & 0o077) throw new Error('Hosted scheduler file must have mode 0600.');
    const hosted = JSON.parse(readFileSync(file, 'utf8')) as { chainId: number; address: Hex };
    assertArcChain(hosted.chainId);
    const target = await requireDeployment();
    const version = await publicClient.readContract({ address: target, abi, functionName: 'version' });
    if (version === '2.2.0') throw new Error('Run upgrade first; 2.2.0 has no scheduler role.');
    await send('set-scheduler', 'owner', 'setScheduler', [hosted.address]);
    const current = await publicClient.readContract({ address: target, abi, functionName: 'scheduler' });
    if (current.toLowerCase() !== hosted.address.toLowerCase()) throw new Error('Scheduler assignment not confirmed.');
    journal.hostedScheduler = hosted.address;
    save();
    console.log(`scheduler is now hosted ${hosted.address}`);
  } else if (command === 'fund-hosted-scheduler') {
    if (!journal.hostedScheduler) throw new Error('Run set-scheduler first.');
    const signer = wallet('owner');
    const to = journal.hostedScheduler;
    await receipt('fund-hosted-scheduler', () => signer.sendTransaction({ to, value: parseNativeUsdc('2') }));
    console.log(`hosted scheduler balance: ${formatEther(await publicClient.getBalance({ address: to }))} USDC`);
  } else
    throw new Error(
      'Use status, weather, deploy, fund, reconcile, cancel-test, browser-test, hosted-test, start, no-winners, settle, claims, rotate-settler, fund-hosted-settler, upgrade, set-scheduler, or fund-hosted-scheduler.',
    );
}
const readOnly = ['status', 'weather'].includes(process.argv[2] ?? 'status');
const lock = `${dir}/operation.lock`;
if (!readOnly) {
  const fd = openSync(lock, 'wx', 0o600);
  writeFileSync(fd, String(process.pid));
  closeSync(fd);
}
main()
  .catch((error: unknown) => {
    let message = error instanceof Error ? error.message : 'Unknown error';
    for (const value of [
      ...Object.entries(process.env)
        .filter(([key]) => /KEY|SECRET|DATABASE|DIRECT_URL/.test(key))
        .map(([, value]) => value),
      ...Object.values(saved.wallets).map((entry) => entry.privateKey),
    ])
      if (value) message = message.replaceAll(value, '[redacted]');
    console.error(
      `Arc lifecycle failed: ${message.slice(0, 300)}. Inspect the local journal before retrying.`,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    if (!readOnly) rmSync(lock);
    await prisma.$disconnect();
  });
