'use client';

import { useSyncExternalStore } from 'react';

let now = 0;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();
function tick(): void {
  now = Date.now();
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!timer) {
    tick();
    timer = setInterval(tick, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}
const serverSnapshot = (): number => 0;
const snapshot = (): number => now;

/** One shared timer, with a stable server placeholder for hydration. */
export function useClientClock(): number {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

const subscribeHydration = (): (() => void) => () => {};
const clientSnapshot = (): boolean => true;
const hydrationServerSnapshot = (): boolean => false;
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeHydration, clientSnapshot, hydrationServerSnapshot);
}
