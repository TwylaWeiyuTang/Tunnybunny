import type { BrowserProvider } from 'ethers';
import { parseUnits, type Hash } from 'viem';
import { getPublicClient, getWalletClient, ARC_CHAINS, type ArcChainId } from './client';

// USDC addresses per chain (testnet)
const USDC_ADDRESSES: Record<number, `0x${string}`> = {
  11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  84532: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  421614: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
};

// CCTP TokenMessenger addresses per chain (testnet)
const TOKEN_MESSENGER: Record<number, `0x${string}`> = {
  11155111: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
  84532: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
  421614: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
};

// CCTP domain IDs
const CCTP_DOMAINS: Record<number, number> = {
  11155111: 0, // Ethereum
  84532: 6,    // Base
  421614: 3,   // Arbitrum
};

const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

const TOKEN_MESSENGER_ABI = [
  {
    name: 'depositForBurn',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'mintRecipient', type: 'bytes32' },
      { name: 'burnToken', type: 'address' },
    ],
    outputs: [{ type: 'uint64' }],
  },
] as const;

export interface BridgeParams {
  sourceChainId: ArcChainId;
  destChainId: ArcChainId;
  amount: string; // USDC amount in human-readable (e.g., "10.50")
  recipient: `0x${string}`;
  provider: BrowserProvider;
}

export interface BridgeResult {
  approveTxHash: Hash;
  bridgeTxHash: Hash;
  sourceChain: string;
  destChain: string;
  amount: string;
}

export type BridgeStatus = 'approving' | 'bridging' | 'waiting' | 'completed';

/**
 * Bridge USDC from one chain to another using Circle CCTP (Arc)
 *
 * Flow:
 * 1. Approve USDC spending by TokenMessenger
 * 2. Call depositForBurn on TokenMessenger
 * 3. CCTP attestation service picks up the burn
 * 4. USDC minted on destination chain
 */
export async function bridgeUSDC(
  params: BridgeParams,
  onStatus?: (status: BridgeStatus) => void,
): Promise<BridgeResult> {
  const { sourceChainId, destChainId, amount, recipient, provider } = params;

  const sourceChain = ARC_CHAINS[sourceChainId];
  const destChain = ARC_CHAINS[destChainId];
  if (!sourceChain || !destChain) {
    throw new Error('Unsupported chain for Arc bridging');
  }

  const usdcAddress = USDC_ADDRESSES[sourceChainId];
  const messengerAddress = TOKEN_MESSENGER[sourceChainId];
  const destDomain = CCTP_DOMAINS[destChainId];

  if (!usdcAddress || !messengerAddress || destDomain === undefined) {
    throw new Error('Missing contract addresses for bridge');
  }

  const publicClient = getPublicClient(sourceChainId);
  const walletClient = await getWalletClient(sourceChainId, provider);
  const [account] = await walletClient.getAddresses();

  const usdcAmount = parseUnits(amount, 6);

  // Convert recipient address to bytes32 (pad to 32 bytes)
  const mintRecipient = `0x000000000000000000000000${recipient.slice(2)}` as `0x${string}`;

  // Step 1: Approve USDC
  onStatus?.('approving');
  const approveHash = await walletClient.writeContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [messengerAddress, usdcAmount],
    account,
  });

  await publicClient.waitForTransactionReceipt({ hash: approveHash });

  // Step 2: Deposit for burn (initiates cross-chain transfer)
  onStatus?.('bridging');
  const bridgeHash = await walletClient.writeContract({
    address: messengerAddress,
    abi: TOKEN_MESSENGER_ABI,
    functionName: 'depositForBurn',
    args: [usdcAmount, destDomain, mintRecipient, usdcAddress],
    account,
  });

  await publicClient.waitForTransactionReceipt({ hash: bridgeHash });

  // Step 3: CCTP attestation happens automatically (takes ~15-20 min on testnet)
  onStatus?.('waiting');

  onStatus?.('completed');

  return {
    approveTxHash: approveHash,
    bridgeTxHash: bridgeHash,
    sourceChain: sourceChain.name,
    destChain: destChain.name,
    amount,
  };
}

/**
 * Get USDC balance on a given chain
 */
export async function getUsdcBalance(
  chainId: ArcChainId,
  address: `0x${string}`,
): Promise<string> {
  const usdcAddress = USDC_ADDRESSES[chainId];
  if (!usdcAddress) return '0';

  const publicClient = getPublicClient(chainId);
  const balance = await publicClient.readContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address],
  });

  // Convert from 6 decimals to human-readable
  const num = Number(balance) / 1e6;
  return num.toFixed(2);
}
