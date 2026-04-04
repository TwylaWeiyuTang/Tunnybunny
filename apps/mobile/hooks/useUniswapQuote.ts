import { useQuery } from '@tanstack/react-query';
import { getQuote, type QuoteResponse } from '@/services/uniswap/client';
import { getUsdcAddress, getTokenAddress, parseTokenAmount, type TokenInfo } from '@/services/uniswap/tokens';

interface UseUniswapQuoteParams {
  token: TokenInfo;
  usdAmount: number; // in USD cents
  chainId: number;
  swapperAddress?: string;
  enabled?: boolean;
}

interface QuoteResult {
  quote: QuoteResponse | null;
  tokenAmount: string; // human-readable amount of tokenIn needed
  gasFeeUsd: string;
  priceImpact: string;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook to fetch Uniswap quote for swapping a token to USDC
 * Auto-refreshes every 15 seconds while enabled
 */
export function useUniswapQuote({
  token,
  usdAmount,
  chainId,
  swapperAddress,
  enabled = true,
}: UseUniswapQuoteParams): QuoteResult {
  const usdcAddress = getUsdcAddress(chainId);
  const tokenAddress = getTokenAddress(token.symbol, chainId);
  const isUsdc = token.symbol === 'USDC';

  // Convert USD cents to USDC amount (6 decimals)
  // $10.00 = 1000 cents = 10_000_000 USDC units
  const usdcAmount = (usdAmount * 10_000).toString(); // cents * 10000 = 6 decimal USDC

  const query = useQuery({
    queryKey: ['uniswap-quote', token.symbol, chainId, usdAmount, swapperAddress],
    queryFn: async (): Promise<QuoteResponse> => {
      if (!usdcAddress || !tokenAddress || !swapperAddress) {
        throw new Error('Missing addresses');
      }

      // For EXACT_OUTPUT: we want exactly X USDC out, how much tokenIn do we need?
      return getQuote({
        tokenIn: tokenAddress,
        tokenOut: usdcAddress,
        tokenInChainId: chainId,
        tokenOutChainId: chainId,
        amount: usdcAmount,
        type: 'EXACT_OUTPUT',
        swapper: swapperAddress,
      });
    },
    enabled: enabled && !isUsdc && !!usdcAddress && !!tokenAddress && !!swapperAddress && usdAmount > 0,
    refetchInterval: 15_000, // Refresh quote every 15 seconds
    staleTime: 10_000,
    retry: 2,
  });

  if (isUsdc) {
    return {
      quote: null,
      tokenAmount: (usdAmount / 100).toFixed(2),
      gasFeeUsd: '0',
      priceImpact: '0',
      isLoading: false,
      error: null,
      refetch: () => {},
    };
  }

  const quote = query.data ?? null;
  let tokenAmount = '...';
  let gasFeeUsd = '...';
  let priceImpact = '0';

  if (quote?.quote) {
    const rawAmount = quote.quote.input?.amount || '0';
    // Convert from smallest unit to human-readable
    const num = Number(rawAmount) / 10 ** token.decimals;
    tokenAmount = num.toFixed(6);
    gasFeeUsd = quote.quote.gasFeeUSD || '0';
    priceImpact = (quote.quote.priceImpact ?? 0).toFixed(2);
  }

  return {
    quote,
    tokenAmount,
    gasFeeUsd,
    priceImpact,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}
