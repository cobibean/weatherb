import test from 'node:test';
import assert from 'node:assert/strict';
import { compareLayouts } from '../check-storage-layout.mjs';

const base = {
  storage: [
    { label: 'owner', slot: '0', offset: 0, type: 't_address' },
    { label: 'scheduledMarketIds', slot: '9', offset: 0, type: 't_mapping(t_uint64,t_uint256)' },
    { label: '__gap', slot: '10', offset: 0, type: 't_array(t_uint256)43_storage' },
  ],
};
const ok = {
  storage: [
    { label: 'owner', slot: '0', offset: 0, type: 't_address' },
    { label: 'scheduledMarketIds', slot: '9', offset: 0, type: 't_mapping(t_uint64,t_uint256)' },
    { label: 'scheduler', slot: '10', offset: 0, type: 't_address' },
    { label: '__gap', slot: '11', offset: 0, type: 't_array(t_uint256)42_storage' },
  ],
};

test('accepts new variables that only consume gap slots', () => {
  assert.deepEqual(compareLayouts(base, ok), { ok: true, problems: [] });
});
test('rejects a moved or retyped existing variable', () => {
  const moved = structuredClone(ok);
  moved.storage[1].slot = '10';
  moved.storage[2].slot = '9';
  assert.equal(compareLayouts(base, moved).ok, false);
  const retyped = structuredClone(ok);
  retyped.storage[0].type = 't_uint256';
  assert.equal(compareLayouts(base, retyped).ok, false);
});
test('rejects a gap that shrank by more than the slots consumed', () => {
  const bad = structuredClone(ok);
  bad.storage[3].type = 't_array(t_uint256)41_storage';
  assert.match(compareLayouts(base, bad).problems.join('\n'), /gap/);
});
test('rejects a new variable outside the reserved gap', () => {
  const bad = structuredClone(ok);
  bad.storage.push({ label: 'late', slot: '53', offset: 0, type: 't_uint256' });
  assert.equal(compareLayouts(base, bad).ok, false);
});
