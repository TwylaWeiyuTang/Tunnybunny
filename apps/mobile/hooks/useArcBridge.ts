import { useState, useCallback } from 'react';
import type { BrowserProvider } from 'ethers';
import {
  bridgeUSDC,
  getUsdcBalance,
  type BridgeResult,
  type BridgeStatus,
} from '@/services/arc/bridge';
import type { ArcChainId } from '@/services/arc/bridge';

interface UseArcBridgeResult {
  bridge: (params: {
    sourceChainId: ArcChainId;
    destChainId: ArcChainId;
    amount: string;
    recipient: `0x${string}`;
    provider: BrowserProvider;
  }) => Promise<BridgeResult>;
  bridgeStatus: BridgeStatus | 'idle' | 'error';
  bridgeResult: BridgeResult | null;
  error: string | null;
  fetchBalance: (chainId: ArcChainId, address: `0x${string}`) => Promise<string>;
}

/**
 * Hook for Arc USDC cross-chain bridging
 */
export function useArcBridge(): UseArcBridgeResult {
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus | 'idle' | 'error'>('idle');
  const [bridgeResult, setBridgeResult] = useState<BridgeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bridge = useCallback(
    async (params: {
      sourceChainId: ArcChainId;
      destChainId: ArcChainId;
      amount: string;
      recipient: `0x${string}`;
      provider: BrowserProvider;
    }) => {
      setBridgeStatus('idle');
      setError(null);
      setBridgeResult(null);

      try {
        const result = await bridgeUSDC(params, (status) => {
          setBridgeStatus(status);
        });

        setBridgeResult(result);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Bridge failed';
        setError(message);
        setBridgeStatus('error');
        throw err;
      }
    },
    [],
  );

  const fetchBalance = useCallback(
    async (chainId: ArcChainId, address: `0x${string}`) => {
      return getUsdcBalance(chainId, address);
    },
    [],
  );

  return { bridge, bridgeStatus, bridgeResult, error, fetchBalance };
}
