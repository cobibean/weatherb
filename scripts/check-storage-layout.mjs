import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const gapLength = (type) => Number(/t_array\(t_uint256\)(\d+)_storage/.exec(type)?.[1] ?? NaN);
// Struct type strings embed a compiler AST node id (t_struct(Market)46187) that shifts with any source edit; normalize it away.
const normType = (type) => String(type).replace(/t_struct\(([A-Za-z0-9_]+)\)\d+/g, 't_struct($1)');

/** Every baseline variable must be identical; new variables may only occupy former gap slots. */
export function compareLayouts(baseline, current) {
  const problems = [];
  const byLabel = new Map(current.storage.map((e) => [e.label, e]));
  const baseGap = baseline.storage.find((e) => e.label === '__gap');
  const curGap = byLabel.get('__gap');
  if (!baseGap || !curGap) return { ok: false, problems: ['__gap missing from baseline or current layout'] };
  for (const entry of baseline.storage) {
    if (entry.label === '__gap') continue;
    const cur = byLabel.get(entry.label);
    if (!cur) { problems.push(`removed: ${entry.label}`); continue; }
    for (const key of ['slot', 'offset', 'type'])
      if ((key === 'type' ? normType(cur[key]) : String(cur[key])) !== (key === 'type' ? normType(entry[key]) : String(entry[key])))
        problems.push(`${entry.label}.${key} changed ${entry[key]} -> ${cur[key]}`);
  }
  const gapStart = Number(baseGap.slot);
  const gapEnd = gapStart + gapLength(baseGap.type); // exclusive
  const baseLabels = new Set(baseline.storage.map((e) => e.label));
  let consumed = 0;
  for (const entry of current.storage) {
    if (baseLabels.has(entry.label)) continue;
    const slot = Number(entry.slot);
    if (slot < gapStart || slot >= gapEnd) problems.push(`new variable outside reserved gap: ${entry.label} @ ${slot}`);
    consumed = Math.max(consumed, slot - gapStart + 1);
  }
  const expectedGapSlot = gapStart + consumed;
  const expectedGapLength = gapLength(baseGap.type) - consumed;
  if (Number(curGap.slot) !== expectedGapSlot || gapLength(curGap.type) !== expectedGapLength)
    problems.push(`gap must start at ${expectedGapSlot} with length ${expectedGapLength}; found slot ${curGap.slot} ${curGap.type}`);
  return { ok: problems.length === 0, problems };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = new URL('../', import.meta.url);
  const baseline = JSON.parse(readFileSync(new URL('contracts/storage-layout/WeatherMarketV2-2.2.0.json', root), 'utf8'));
  const artifact = JSON.parse(readFileSync(new URL('contracts/out/WeatherMarketV2.sol/WeatherMarketV2.json', root), 'utf8'));
  if (!artifact.storageLayout) { console.error('Artifact lacks storageLayout; add extra_output = ["storageLayout"] to foundry.toml and rebuild.'); process.exit(1); }
  const result = compareLayouts(baseline, artifact.storageLayout);
  if (!result.ok) { console.error('Storage layout is NOT upgrade-safe:\n' + result.problems.join('\n')); process.exit(1); }
  console.log(`Storage layout preserves the ${baseline.version} baseline.`);
}
