/**
 * useTestRunStream Hook
 *
 * React hook for subscribing to real-time test run updates via Server-Sent Events (SSE).
 * Automatically reconnects on error and cleans up on unmount.
 */

import { useEffect, useState, useRef } from 'react';

export interface TestRunMarket {
  id: string;
  resolveTime: string;
  isSettled: boolean;
  outcome: 'YES' | 'NO' | null;
  city: string;
  threshold: number;
  actualTemp?: number;        // NEW
  settledAt?: string;          // NEW
  createdAt: string;
}

export interface TestRunData {
  id: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  completedAt?: string;
  marketsCreated: number;
  marketsSettled: number;
  fundingAmount: string;
  recoveredAmount?: string;
  netCost?: string;
  cityName: string;
  markets: TestRunMarket[];
}

export interface UseTestRunStreamResult {
  testRun: TestRunData | null;
  isConnected: boolean;
  error: string | null;
}

/**
 * Subscribe to real-time updates for a test run
 */
export function useTestRunStream(
  testRunId: string
): UseTestRunStreamResult {
  const [testRun, setTestRun] = useState<TestRunData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!testRunId) {
      return;
    }

    // SSE implementation using fetch with cookie-based auth
    const url = `/api/admin/test-runs/${testRunId}/stream`;
    let controller: AbortController;
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    const connect = async () => {
      try {
        controller = new AbortController();

        const response = await fetch(url, {
          credentials: 'include', // Include cookies for auth
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Stream failed: ${response.status}`);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        setIsConnected(true);
        setError(null);

        reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            setIsConnected(false);
            break;
          }

          // Decode chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });

          // Process complete messages
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || ''; // Keep incomplete message in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.error) {
                  setError(data.error);
                  setIsConnected(false);
                } else {
                  setTestRun(data);
                }
              } catch (err) {
                console.error('[useTestRunStream] Parse error:', err);
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error) {
          if (err.name === 'AbortError') {
            // Normal cleanup, don't set error
            return;
          }
          setError(err.message);
        } else {
          setError('Unknown error');
        }
        setIsConnected(false);
      }
    };

    connect();

    // Cleanup function
    return () => {
      if (controller) {
        controller.abort();
      }
      if (reader) {
        reader.cancel();
      }
      setIsConnected(false);
    };
  }, [testRunId]);

  return { testRun, isConnected, error };
}
