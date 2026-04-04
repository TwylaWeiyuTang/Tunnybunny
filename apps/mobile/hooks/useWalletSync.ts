import { useEffect } from 'react';
import { useAccount } from '@reown/appkit-react-native';
import { useWalletStore } from '@/store/wallet';

/**
 * Syncs Reown AppKit wallet state to our Zustand store
 * so non-AppKit components can access wallet info
 */
export function useWalletSync() {
  const { address, isConnected, chainId } = useAccount();
  const { setWallet, disconnect } = useWalletStore();

  useEffect(() => {
    if (isConnected && address) {
      setWallet(address, chainId ? Number(chainId) : 0);
    } else if (!isConnected) {
      disconnect();
    }
  }, [isConnected, address, chainId, setWallet, disconnect]);
}
