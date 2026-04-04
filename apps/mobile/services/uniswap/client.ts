const BACKEND_URL = __DEV__
  ? 'http://localhost:3001'
  : 'https://tunnybunny-api.railway.app';

export interface QuoteRequest {
  tokenIn: string;
  tokenOut: string;
  tokenInChainId: number;
  tokenOutChainId: number;
  amount: string;
  type: 'EXACT_INPUT' | 'EXACT_OUTPUT';
  swapper: string;
  slippageTolerance?: number;
}

export interface QuoteResponse {
  requestId: string;
  quote: {
    input: { amount: string; token: string };
    output: { amount: string; token: string };
    gasFee: string;
    gasFeeUSD: string;
    priceImpact: number;
    route: unknown[];
  };
  permit2?: {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    values: Record<string, unknown>;
  };
  routing: string;
}

export interface SwapRequest {
  quote: QuoteResponse;
  permit2Signature?: string;
  simulateTransaction?: boolean;
}

export interface SwapResponse {
  swap: {
    to: string;
    data: string;
    value: string;
    gasLimit: string;
  };
  gasFee: string;
}

/**
 * Fetch a quote from Uniswap via our backend proxy
 */
export async function getQuote(params: QuoteRequest): Promise<QuoteResponse> {
  const response = await fetch(`${BACKEND_URL}/api/quotes/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Quote request failed' }));
    throw new Error(error.error || `Quote failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Build a swap transaction from a quote via our backend proxy
 */
export async function getSwap(params: SwapRequest): Promise<SwapResponse> {
  const response = await fetch(`${BACKEND_URL}/api/quotes/swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Swap request failed' }));
    throw new Error(error.error || `Swap failed: ${response.status}`);
  }

  return response.json();
}
