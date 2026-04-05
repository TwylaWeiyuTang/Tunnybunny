import { getUsdcBalance, CHAIN_NAMES, type ArcChainId } from './bridge';

export interface ChainBalance {
  chainId: ArcChainId;
  chainName: string;
  balance: number; // human-readable USD
}

export interface RouteStep {
  chainId: ArcChainId;
  chainName: string;
  amount: number; // USD to source from this chain
}

export interface RoutePlan {
  steps: RouteStep[];
  totalAvailable: number;
  needsBridge: boolean;
  settlementChain: ArcChainId; // where the final payment lands
}

const ALL_CHAINS: ArcChainId[] = [42161, 8453, 1];

/**
 * Fetch USDC balances across all supported chains in parallel.
 * Returns a unified view of the user's cross-chain USDC liquidity.
 */
export async function getAggregatedBalance(
  address: `0x${string}`,
): Promise<ChainBalance[]> {
  const results = await Promise.allSettled(
    ALL_CHAINS.map(async (chainId) => {
      const balance = await getUsdcBalance(chainId, address);
      return {
        chainId,
        chainName: CHAIN_NAMES[chainId] || `Chain ${chainId}`,
        balance: parseFloat(balance),
      };
    }),
  );

  return results
    .filter((r): r is PromiseFulfilledResult<ChainBalance> => r.status === 'fulfilled')
    .map((r) => r.value);
}

/**
 * Compute the optimal route to source a USDC payment.
 *
 * Strategy:
 * 1. If any single chain has enough, use the one with the lowest bridge cost
 *    (prefer settlement chain to avoid bridging entirely)
 * 2. If no single chain suffices, split across chains (greedy: largest first)
 *
 * This is the core "chain abstraction" logic — the user says "pay $X"
 * and we figure out where to pull the USDC from.
 */
export function computeRoute(
  balances: ChainBalance[],
  amountUsd: number,
  settlementChain: ArcChainId = 42161, // default: Arbitrum
): RoutePlan {
  const totalAvailable = balances.reduce((sum, b) => sum + b.balance, 0);

  // Sort: settlement chain first (no bridge needed), then by balance descending
  const sorted = [...balances].sort((a, b) => {
    if (a.chainId === settlementChain) return -1;
    if (b.chainId === settlementChain) return 1;
    return b.balance - a.balance;
  });

  const steps: RouteStep[] = [];
  let remaining = amountUsd;

  for (const chain of sorted) {
    if (remaining <= 0) break;
    if (chain.balance <= 0) continue;

    const take = Math.min(chain.balance, remaining);
    steps.push({
      chainId: chain.chainId,
      chainName: chain.chainName,
      amount: Math.round(take * 100) / 100,
    });
    remaining -= take;
  }

  const needsBridge = steps.some((s) => s.chainId !== settlementChain);

  return { steps, totalAvailable, needsBridge, settlementChain };
}
