import axios from 'axios';
import { z } from 'zod';

const hubUrl = process.env['FDC_HUB_URL'] ?? 'https://fdc-hub.flare.network';

const submitResponseSchema = z.object({
  requestId: z.string(),
});

const statusResponseSchema = z.object({
  status: z.enum(['pending', 'finalized', 'failed']),
  proof: z.string().optional(),
  attestationData: z.string().optional(),
  error: z.string().optional(),
});

export type AttestationRequest = {
  attestationType: string;
  sourceId: string;
  requestBody: {
    url: string;
    postprocessJq: string;
    abi_signature: string;
  };
};

export type AttestationResult = {
  proof: string;
  attestationData: string;
};

export type SubmitOptions = {
  maxWaitMs?: number;
  pollIntervalMs?: number;
  maxRetries?: number;
};

export function prepareAttestationRequest(params: { weatherUrl: string }): AttestationRequest {
  return {
    attestationType: '0x576562324a736f6e00000000000000000000000000000000', // "Web2Json" padded
    sourceId: '0x0000000000000000000000000000000000000000000000000000000000000001',
    requestBody: {
      url: params.weatherUrl,
      postprocessJq: '.tempF_tenths',
      abi_signature: '(bytes32 cityId, uint64 observedTimestamp, uint256 tempTenths)',
    },
  };
}

export async function submitAndWaitForProof(
  request: AttestationRequest,
  options: SubmitOptions = {},
): Promise<AttestationResult> {
  const maxWaitMs = options.maxWaitMs ?? 120_000;
  const pollIntervalMs = options.pollIntervalMs ?? 5_000;
  const maxRetries = options.maxRetries ?? 5;

  const requestId = await submitWithRetries(request, maxRetries);

  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const response = await axios.get(`${hubUrl}/attestation/status/${requestId}`);
    const data = statusResponseSchema.parse(response.data);

    if (data.status === 'finalized') {
      if (!data.proof || !data.attestationData) {
        throw new Error('FDC finalized without proof/attestationData');
      }
      return { proof: data.proof, attestationData: data.attestationData };
    }

    if (data.status === 'failed') {
      throw new Error(`FDC attestation failed: ${data.error ?? 'unknown error'}`);
    }

    await sleep(pollIntervalMs);
  }

  throw new Error('FDC attestation timeout');
}

async function submitWithRetries(request: AttestationRequest, maxRetries: number): Promise<string> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await axios.post(`${hubUrl}/attestation/request`, request);
      const data = submitResponseSchema.parse(response.data);
      return data.requestId;
    } catch (error) {
      lastError = error;
      const backoff = Math.min(10_000, 500 * 2 ** attempt);
      await sleep(backoff);
    }
  }
  throw new Error(`FDC submit failed after retries: ${String(lastError)}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
