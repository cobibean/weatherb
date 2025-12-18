export function logInfo(message: string, data?: unknown): void {
  const prefix = `${new Date().toISOString()} [Settler]`;
  if (data === undefined) {
    // eslint-disable-next-line no-console
    console.log(`${prefix} ${message}`);
  } else {
    // eslint-disable-next-line no-console
    console.log(`${prefix} ${message}`, data);
  }
}

export function logError(message: string, error?: unknown): void {
  const prefix = `${new Date().toISOString()} [Settler]`;
  if (error === undefined) {
    // eslint-disable-next-line no-console
    console.error(`${prefix} ${message}`);
  } else {
    // eslint-disable-next-line no-console
    console.error(`${prefix} ${message}`, error);
  }
}
