import { create } from 'zustand';

export interface SettlementState {
  groupId: string | null;
  from: string | null;
  to: string | null;
  amount: number; // USD cents
  tokenIn: string; // token address
  tokenSymbol: string;
  sourceChain: number;
  destChain: number;
  isPrivate: boolean;
  status: 'idle' | 'quoting' | 'swapping' | 'bridging' | 'settling' | 'completed' | 'failed';
  txHash: string | null;
  error: string | null;
}

interface SettlementStore extends SettlementState {
  setSettlement: (data: Partial<SettlementState>) => void;
  setStatus: (status: SettlementState['status']) => void;
  setPrivate: (isPrivate: boolean) => void;
  reset: () => void;
}

const initialState: SettlementState = {
  groupId: null,
  from: null,
  to: null,
  amount: 0,
  tokenIn: '',
  tokenSymbol: 'USDC',
  sourceChain: 84532, // Base Sepolia
  destChain: 84532,
  isPrivate: false,
  status: 'idle',
  txHash: null,
  error: null,
};

export const useSettlementStore = create<SettlementStore>((set) => ({
  ...initialState,

  setSettlement: (data) => set((state) => ({ ...state, ...data })),

  setStatus: (status) => set({ status }),

  setPrivate: (isPrivate) => set({ isPrivate }),

  reset: () => set(initialState),
}));
