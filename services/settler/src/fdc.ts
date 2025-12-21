import axios from 'axios';
import { z } from 'zod';

/**
 * FDC (Flare Data Connector) Client for Web2Json Attestations
 *
 * Architecture (Coston2 testnet):
 * 1. Send request to JQ Verifier to get abiEncodedRequest
 * 2. Submit abiEncodedRequest to FdcHub smart contract (on-chain)
 * 3. Wait for round finalization (~90-180 seconds)
 * 4. Retrieve proof from Data Availability Layer
 *
 * For testnet development, we use the simplified verifier flow.
 */

// Coston2 testnet URLs
const COSTON2_VERIFIER_URL = 'https://jq-verifier-test.flare.rocks';
const COSTON2_DA_LAYER_URL = 'https://ctn2-data-availability.flare.network';

// Public API key for development (rate-limited)
const PUBLIC_API_KEY = '00000000-0000-0000-0000-000000000000';

function getVerifierUrl(): string {
  return process.env['FDC_VERIFIER_URL'] ?? COSTON2_VERIFIER_URL;
}

function getDALayerUrl(): string {
  return process.env['FDC_DA_LAYER_URL'] ?? COSTON2_DA_LAYER_URL;
}

// Attestation type constants (UTF8 hex encoded, zero-padded to 32 bytes)
// "Web2Json" = 0x576562324a736f6e + 24 zero bytes
export const WEB2JSON_ATTESTATION_TYPE = '0x576562324a736f6e000000000000000000000000000000000000000000000000';
// "WEB2" source ID
export const WEB2_SOURCE_ID = '0x5745423200000000000000000000000000000000000000000000000000000000';

const prepareResponseSchema = z.object({
  abiEncodedRequest: z.string(),
  status: z.string().optional(),
});

const daLayerResponseSchema = z.object({
  status: z.string(),
  response: z
    .object({
      attestationType: z.string(),
      sourceId: z.string(),
      votingRound: z.number(),
      lowestUsedTimestamp: z.number(),
      requestBody: z.object({}).passthrough(),
      responseBody: z.object({}).passthrough(),
      proof: z.array(z.string()),
    })
    .optional(),
});

export type Web2JsonRequestBody = {
  url: string;
  httpMethod?: string;
  headers?: string;
  queryParams?: string;
  body?: string;
  postProcessJq: string;
  abiSignature: string;
};

export type AttestationRequest = {
  attestationType: string;
  sourceId: string;
  requestBody: Web2JsonRequestBody;
};

export type AttestationResult = {
  proof: string;
  attestationData: string;
  roundId: number;
};

export type SubmitOptions = {
  maxWaitMs?: number;
  pollIntervalMs?: number;
  maxRetries?: number;
};

/**
 * Prepare a Web2Json attestation request for MET Norway weather API.
 *
 * The JQ filter extracts the temperature from MET Norway's JSON response
 * and converts it to our expected format.
 *
 * MET Norway response structure:
 * {
 *   "properties": {
 *     "timeseries": [{
 *       "time": "2024-12-18T20:00:00Z",
 *       "data": {
 *         "instant": {
 *           "details": {
 *             "air_temperature": 3.5  // Celsius
 *           }
 *         }
 *       }
 *     }, ...]
 *   }
 * }
 *
 * We need to:
 * 1. Get the first timeseries entry at or after our target time
 * 2. Extract air_temperature (Celsius)
 * 3. Convert to Fahrenheit tenths: (C * 9/5 + 32) * 10
 */
export function prepareMetNoAttestationRequest(params: {
  latitude: number;
  longitude: number;
  targetTimestamp: number;
  cityIdBytes32: string;
}): AttestationRequest {
  // Build the MET Norway API URL
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${params.latitude}&lon=${params.longitude}`;

  // JQ filter to:
  // 1. Get the first timeseries item (current/nearest observation)
  // 2. Extract air_temperature in Celsius
  // 3. Convert to Fahrenheit tenths: (C * 9/5 + 32) * 10
  // 4. Round to integer
  // 5. Also extract the timestamp
  //
  // Note: JQ doesn't have great floating point, so we use integer math where possible
  // Formula: F_tenths = (C * 18 + 320) where C is in tenths
  const postProcessJq = `
    .properties.timeseries[0] |
    {
      cityId: "${params.cityIdBytes32}",
      observedTimestamp: (.time | fromdateiso8601),
      tempTenths: ((.data.instant.details.air_temperature * 10 | floor) * 18 / 10 + 320 | floor)
    }
  `.replace(/\s+/g, ' ').trim();

  return {
    attestationType: WEB2JSON_ATTESTATION_TYPE,
    sourceId: WEB2_SOURCE_ID,
    requestBody: {
      url,
      httpMethod: 'GET',
      headers: JSON.stringify({ 'User-Agent': 'WeatherB/1.0 (FDC-Attestation)' }),
      queryParams: '{}',
      body: '{}',
      postProcessJq,
      abiSignature: '(bytes32 cityId, uint64 observedTimestamp, uint256 tempTenths)',
    },
  };
}

/**
 * Legacy function for backward compatibility.
 * Use prepareMetNoAttestationRequest for production.
 */
export function prepareAttestationRequest(params: { weatherUrl: string }): AttestationRequest {
  return {
    attestationType: WEB2JSON_ATTESTATION_TYPE,
    sourceId: WEB2_SOURCE_ID,
    requestBody: {
      url: params.weatherUrl,
      postProcessJq: '.tempF_tenths',
      abiSignature: '(bytes32 cityId, uint64 observedTimestamp, uint256 tempTenths)',
    },
  };
}

/**
 * Step 1: Prepare the attestation request via the verifier.
 * This returns the abiEncodedRequest needed for on-chain submission.
 */
export async function prepareWithVerifier(
  request: AttestationRequest,
): Promise<{ abiEncodedRequest: string }> {
  const verifierUrl = getVerifierUrl();

  // The verifier expects the requestBody as a JSON string
  const payload = {
    attestationType: request.attestationType,
    sourceId: request.sourceId,
    requestBody: JSON.stringify(request.requestBody),
  };

  const response = await axios.post(`${verifierUrl}/Web2Json/prepareRequest`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': PUBLIC_API_KEY,
    },
  });

  const data = prepareResponseSchema.parse(response.data);
  return { abiEncodedRequest: data.abiEncodedRequest };
}

/**
 * Step 2 & 3: Submit to FdcHub and wait for finalization.
 *
 * Note: This requires on-chain interaction with the FdcHub contract.
 * For now, this is a placeholder - the actual implementation needs:
 * - FdcHub contract address on Coston2
 * - Wallet client to submit the transaction
 * - Fee calculation via fdcRequestFeeConfigurations
 *
 * The full implementation should be done when integrating with the
 * settlement service's viem wallet client.
 */
export async function submitAndWaitForProof(
  request: AttestationRequest,
  options: SubmitOptions = {},
): Promise<AttestationResult> {
  const maxWaitMs = options.maxWaitMs ?? 180_000; // FDC rounds take 90-180s
  const pollIntervalMs = options.pollIntervalMs ?? 10_000;
  const maxRetries = options.maxRetries ?? 3;

  // Step 1: Prepare with verifier
  let abiEncodedRequest: string;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const prepared = await prepareWithVerifier(request);
      abiEncodedRequest = prepared.abiEncodedRequest;
      break;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await sleep(Math.min(10_000, 1000 * 2 ** attempt));
      }
    }
  }

  if (!abiEncodedRequest!) {
    throw new Error(`FDC verifier preparation failed: ${String(lastError)}`);
  }

  // Step 2: Submit to FdcHub (on-chain)
  // TODO: Implement on-chain submission
  // This requires:
  // - Getting FdcHub contract instance
  // - Calculating attestation fee
  // - Submitting transaction
  // - Extracting roundId from tx receipt

  // For now, throw a descriptive error
  throw new Error(
    'FDC on-chain submission not yet implemented. ' +
      'The verifier returned abiEncodedRequest: ' +
      abiEncodedRequest.slice(0, 66) +
      '... ' +
      'Next step: submit to FdcHub contract and poll DA Layer for proof.',
  );

  // Step 3: Poll DA Layer for proof (after on-chain implementation)
  // const daUrl = getDALayerUrl();
  // const proofResponse = await axios.get(
  //   `${daUrl}/api/v0/fdc/get-proof-round-id-bytes`,
  //   { params: { roundId, requestBytes: abiEncodedRequest } }
  // );
}

/**
 * Query the DA Layer for a finalized attestation proof.
 * Use this after the FDC round has finalized (check via FlareSystemsManager).
 */
export async function getProofFromDALayer(
  roundId: number,
  abiEncodedRequest: string,
): Promise<AttestationResult | null> {
  const daUrl = getDALayerUrl();

  try {
    const response = await axios.get(`${daUrl}/api/v0/fdc/get-proof-round-id-bytes`, {
      params: {
        roundId,
        requestBytes: abiEncodedRequest,
      },
      headers: {
        'X-API-KEY': PUBLIC_API_KEY,
      },
    });

    const data = daLayerResponseSchema.parse(response.data);

    if (data.status !== 'OK' || !data.response) {
      return null;
    }

    // Combine proof array into single bytes
    const proofBytes = data.response.proof.join('');

    return {
      proof: proofBytes,
      attestationData: JSON.stringify(data.response.responseBody),
      roundId: data.response.votingRound,
    };
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
