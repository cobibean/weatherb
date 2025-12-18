import { describe, expect, it } from 'vitest';

import { nextOutageState } from './outage-controller';

describe('outage-controller', () => {
  it('enters outage on red and exits on non-red', () => {
    const a = nextOutageState({ isOutage: false }, 'red');
    expect(a.next.isOutage).toBe(true);
    expect(a.changed).toBe(true);

    const b = nextOutageState(a.next, 'red');
    expect(b.next.isOutage).toBe(true);
    expect(b.changed).toBe(false);

    const c = nextOutageState(b.next, 'green');
    expect(c.next.isOutage).toBe(false);
    expect(c.changed).toBe(true);
  });
});
