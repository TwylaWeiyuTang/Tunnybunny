import { create } from 'zustand';

interface WalletStore {
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
  setWallet: (address: string, chainId: number) => void;
  disconnect: () => void;
}

export const useWalletStore = create<WalletStore>((set) => ({
  address: null,
  chainId: null,
  isConnected: false,

  setWallet: (address, chainId) =>
    set({ address, chainId, isConnected: true }),

  disconnect: () =>
    set({ address: null, chainId: null, isConnected: false }),
}));
