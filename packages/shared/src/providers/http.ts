import { z } from 'zod';

export type FetchJsonOptions = {
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

const contentTypeSchema = z.string().optional();

export async function fetchJson<T>(
  url: string,
  schema: z.ZodType<T>,
  options: FetchJsonOptions = {},
): Promise<T> {
  const init: RequestInit = {
    headers: {
      accept: 'application/json',
      ...options.headers,
    },
  };
  if (options.signal) init.signal = options.signal;
  const response = await fetch(url, init);

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}: ${body}`);
  }

  const contentType = contentTypeSchema.parse(response.headers.get('content-type') ?? undefined);
  if (contentType && !contentType.includes('application/json') && !contentType.includes('+json')) {
    throw new Error(`Unexpected content-type for ${url}: ${contentType}`);
  }

  const json = (await response.json()) as unknown;
  return schema.parse(json);
}
