import { createUnlink, unlinkAccount, unlinkEvm } from '@unlink-xyz/sdk';
import { createPublicClient, createWalletClient, http, custom } from 'viem';
import { baseSepolia } from 'viem/chains';
import type { BrowserProvider } from 'ethers';

// Unlink operates on Base Sepolia
const UNLINK_CHAIN = baseSepolia;
const UNLINK_ENGINE_URL = 'https://api.unlink.xyz';

/**
 * Create an Unlink client from the connected wallet's ethers provider.
 * This bridges AppKit's ethers provider -> viem -> Unlink SDK.
 */
export async function createUnlinkClient(
  ethersProvider: BrowserProvider,
  apiKey: string,
  mnemonic: string,
) {
  // Get EIP-1193 provider from ethers for viem
  const eip1193Provider = (ethersProvider as any).provider;

  const walletClient = createWalletClient({
    chain: UNLINK_CHAIN,
    transport: custom(eip1193Provider),
  });

  const publicClient = createPublicClient({
    chain: UNLINK_CHAIN,
    transport: http(UNLINK_CHAIN.rpcUrls.default.http[0]),
  });

  const unlink = createUnlink({
    engineUrl: UNLINK_ENGINE_URL,
    apiKey,
    account: unlinkAccount.fromMnemonic({ mnemonic }),
    evm: unlinkEvm.fromViem({ walletClient, publicClient }),
  });

  return unlink;
}

export type UnlinkClient = Awaited<ReturnType<typeof createUnlinkClient>>;
