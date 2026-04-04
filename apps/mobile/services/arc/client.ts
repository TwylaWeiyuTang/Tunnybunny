import { createPublicClient, createWalletClient, http, custom } from 'viem';
import { baseSepolia, sepolia, arbitrumSepolia } from 'viem/chains';
import type { BrowserProvider } from 'ethers';

/**
 * Supported chains for Arc USDC bridging
 */
export const ARC_CHAINS = {
  11155111: sepolia,
  84532: baseSepolia,
  421614: arbitrumSepolia,
} as const;

export type ArcChainId = keyof typeof ARC_CHAINS;

/**
 * Create a viem public client for reading chain state
 */
export function getPublicClient(chainId: ArcChainId) {
  const chain = ARC_CHAINS[chainId];
  if (!chain) throw new Error(`Chain ${chainId} not supported for Arc bridging`);

  return createPublicClient({
    chain,
    transport: http(),
  });
}

/**
 * Create a viem wallet client from an ethers provider
 * (bridges the Reown AppKit ethers provider to viem for Arc Bridge Kit)
 */
export async function getWalletClient(chainId: ArcChainId, ethersProvider: BrowserProvider) {
  const chain = ARC_CHAINS[chainId];
  if (!chain) throw new Error(`Chain ${chainId} not supported for Arc bridging`);

  // Get the underlying EIP-1193 provider from ethers
  const provider = (ethersProvider as any).provider;

  return createWalletClient({
    chain,
    transport: custom(provider),
  });
}
