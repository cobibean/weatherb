import { describe, it, expect } from 'vitest';
import {
  celsiusToFahrenheitTenths,
  fahrenheitTenthsToDisplay,
} from '../temperature';

describe('celsiusToFahrenheitTenths', () => {
  it('converts 0C to 320 tenths (32F)', () => {
    expect(celsiusToFahrenheitTenths(0)).toBe(320);
  });

  it('converts 100C to 2120 tenths (212F)', () => {
    expect(celsiusToFahrenheitTenths(100)).toBe(2120);
  });

  it('converts negative temperatures correctly', () => {
    // -40C = -40F (special case where they're equal)
    expect(celsiusToFahrenheitTenths(-40)).toBe(-400);
  });

  it('handles decimal Celsius values', () => {
    // 25.5C = 77.9F = 779 tenths
    expect(celsiusToFahrenheitTenths(25.5)).toBe(779);
  });

  it('rounds to nearest tenth', () => {
    // 20C = 68F exactly
    expect(celsiusToFahrenheitTenths(20)).toBe(680);
  });
});

describe('fahrenheitTenthsToDisplay', () => {
  it('rounds to nearest whole degree', () => {
    expect(fahrenheitTenthsToDisplay(854)).toBe(85);
    expect(fahrenheitTenthsToDisplay(855)).toBe(86);
  });

  it('handles exact values', () => {
    expect(fahrenheitTenthsToDisplay(850)).toBe(85);
  });

  it('handles negative temperatures', () => {
    expect(fahrenheitTenthsToDisplay(-154)).toBe(-15);
  });
});
