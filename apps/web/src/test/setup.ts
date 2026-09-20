import { afterEach, expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { takeBlockedAttempts } from '../../../../scripts/verification/network-guard.mjs';

expect.extend(matchers);

afterEach(() => {
  expect(takeBlockedAttempts(), 'Unexpected real network access: mock the service boundary').toBe(
    0,
  );
});
