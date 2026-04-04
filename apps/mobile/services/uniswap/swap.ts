import { type BrowserProvider } from 'ethers';
import { getQuote, getSwap, type QuoteResponse } from './client';
import { getUsdcAddress, getTokenAddress } from './tokens';

interface SwapParams {
  tokenSymbol: string;
  amountCents: number; // USD cents to receive as USDC
  chainId: number;
  swapperAddress: string;
  provider: BrowserProvider;
}

interface SwapResult {
  txHash: string;
  usdcReceived: string;
}

/**
 * Execute a full swap: get quote -> sign permit2 (if needed) -> build swap tx -> send
 */
export async function executeSwap(params: SwapParams): Promise<SwapResult> {
  const { tokenSymbol, amountCents, chainId, swapperAddress, provider } = params;

  const tokenAddress = getTokenAddress(tokenSymbol, chainId);
  const usdcAddress = getUsdcAddress(chainId);

  if (!tokenAddress || !usdcAddress) {
    throw new Error(`Token ${tokenSymbol} not available on chain ${chainId}`);
  }

  // Convert cents to USDC units (6 decimals): $10.00 = 1000 cents = 10_000_000
  const usdcAmount = (amountCents * 10_000).toString();

  // Step 1: Get quote
  const quote = await getQuote({
    tokenIn: tokenAddress,
    tokenOut: usdcAddress,
    tokenInChainId: chainId,
    tokenOutChainId: chainId,
    amount: usdcAmount,
    type: 'EXACT_OUTPUT',
    swapper: swapperAddress,
  });

  // Step 2: Sign permit2 if required
  let permit2Signature: string | undefined;
  if (quote.permit2) {
    const signer = await provider.getSigner();
    permit2Signature = await signer.signTypedData(
      quote.permit2.domain as any,
      quote.permit2.types as any,
      quote.permit2.values as any,
    );
  }

  // Step 3: Build swap transaction
  const swapData = await getSwap({
    quote,
    permit2Signature,
    simulateTransaction: false,
  });

  // Step 4: Execute the swap transaction
  const signer = await provider.getSigner();
  const tx = await signer.sendTransaction({
    to: swapData.swap.to,
    data: swapData.swap.data,
    value: BigInt(swapData.swap.value || '0'),
    gasLimit: BigInt(swapData.swap.gasLimit || '500000'),
  });

  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error('Swap transaction failed');
  }

  return {
    txHash: receipt.hash,
    usdcReceived: usdcAmount,
  };
}
