export interface Group {
  id: string;
  name: string;
  creator: string; // wallet address
  members: Member[];
  createdAt: number;
}

export interface Member {
  address: string;
  ensName?: string;
  displayName?: string;
}

export interface Expense {
  id: string;
  groupId: string;
  amount: number; // in USD cents
  description: string;
  paidBy: string; // wallet address
  splitAmong: string[]; // wallet addresses
  splitType: 'equal' | 'custom';
  shares?: Record<string, number>; // address -> amount in cents (for custom splits)
  createdAt: number;
}

export interface Balance {
  from: string; // who owes
  to: string; // who is owed
  amount: number; // in USD cents
}

export interface Settlement {
  id: string;
  groupId: string;
  from: string;
  to: string;
  amount: number; // USDC amount (6 decimals)
  tokenIn: string; // token address used to pay
  sourceChain: number; // chain ID
  destChain: number; // chain ID
  private: boolean; // Unlink privacy enabled
  status: 'pending' | 'swapping' | 'bridging' | 'settling' | 'completed' | 'failed';
  txHash?: string;
  createdAt: number;
}

export interface UniswapQuote {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  route: unknown;
  gasEstimate: string;
  priceImpact: string;
}

export type SupportedChain = {
  id: number;
  name: string;
  rpcUrl: string;
  usdcAddress: string;
};
