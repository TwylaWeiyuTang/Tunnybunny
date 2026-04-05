import { create } from 'zustand';

export interface SplitParticipant {
  address: string;
  displayName?: string;
  shareAmount: number; // USDC 6-decimal raw
  status: 'pending' | 'approved' | 'deposited' | 'failed';
  txHash?: string;
}

export interface SplitSession {
  id: string;
  contractSessionId: number | null;
  merchantAddress: string;
  totalAmountRaw: string; // USDC 6-decimal raw
  groupId: string;
  groupName: string;
  participants: SplitParticipant[];
  status: 'creating' | 'waiting-vrf' | 'collecting' | 'settled' | 'failed';
  roulette: boolean;
  wcPaymentId: string | null;
  createdAt: number;
}

interface SplitSessionStore extends SplitSession {
  setSession: (data: Partial<SplitSession>) => void;
  setContractSessionId: (id: number) => void;
  updateParticipant: (address: string, update: Partial<SplitParticipant>) => void;
  setStatus: (status: SplitSession['status']) => void;
  reset: () => void;
}

const initialState: SplitSession = {
  id: '',
  contractSessionId: null,
  merchantAddress: '',
  totalAmountRaw: '0',
  groupId: '',
  groupName: '',
  participants: [],
  status: 'creating',
  roulette: false,
  wcPaymentId: null,
  createdAt: 0,
};

export const useSplitSessionStore = create<SplitSessionStore>((set) => ({
  ...initialState,

  setSession: (data) => set((state) => ({ ...state, ...data })),

  setContractSessionId: (id) => set({ contractSessionId: id }),

  updateParticipant: (address, update) =>
    set((state) => ({
      participants: state.participants.map((p) =>
        p.address.toLowerCase() === address.toLowerCase() ? { ...p, ...update } : p,
      ),
    })),

  setStatus: (status) => set({ status }),

  reset: () => set(initialState),
}));
