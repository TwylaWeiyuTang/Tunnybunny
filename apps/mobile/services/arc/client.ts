import { createPublicClient, createWalletClient, http, custom } from 'viem';
import { mainnet, base, arbitrum } from 'viem/chains';
import type { BrowserProvider } from 'ethers';

/**
 * Supported mainnet chains for Arc USDC bridging (Circle CCTP)
 */
export const ARC_CHAINS = {
  1: mainnet,
  8453: base,
  42161: arbitrum,
} as const;

export type ArcChainId = keyof typeof ARC_CHAINS;

export function getPublicClient(chainId: ArcChainId) {
  const chain = ARC_CHAINS[chainId];
  if (!chain) throw new Error(`Chain ${chainId} not supported for Arc bridging`);

  return createPublicClient({
    chain,
    transport: http(),
  });
}

export async function getWalletClient(chainId: ArcChainId, ethersProvider: BrowserProvider) {
  const chain = ARC_CHAINS[chainId];
  if (!chain) throw new Error(`Chain ${chainId} not supported for Arc bridging`);

  const provider = (ethersProvider as any).provider;

  return createWalletClient({
    chain,
    transport: custom(provider),
  });
}
