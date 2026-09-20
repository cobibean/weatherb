import 'vitest';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

// jest-dom's bundled augmentation targets the pre-Vitest-5 Assertion interface.
declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- ambient extension of Vitest's matcher API
  interface Matchers<R, T> extends TestingLibraryMatchers<T, R> {}
}
