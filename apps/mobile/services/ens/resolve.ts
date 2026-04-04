import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { normalize } from 'viem/ens';

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http('https://eth.llamarpc.com'),
});

/**
 * Check if a string looks like an ENS name (contains a dot, e.g. "alice.eth")
 */
export function isEnsName(input: string): boolean {
  return /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/.test(input.trim());
}

/**
 * Resolve an ENS name to an Ethereum address.
 * Returns null if the name doesn't resolve.
 */
export async function resolveEnsName(name: string): Promise<string | null> {
  try {
    const normalized = normalize(name.trim());
    const address = await publicClient.getEnsAddress({ name: normalized });
    return address ?? null;
  } catch {
    return null;
  }
}

/**
 * Reverse-resolve an address to an ENS name.
 * Returns null if no primary name is set.
 */
export async function lookupEnsName(address: string): Promise<string | null> {
  try {
    const name = await publicClient.getEnsName({
      address: address as `0x${string}`,
    });
    return name ?? null;
  } catch {
    return null;
  }
}
