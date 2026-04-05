import { Contract, BrowserProvider, JsonRpcProvider, parseUnits } from 'ethers';
import type { Hash } from 'viem';

// USDC addresses per chain (mainnet)
const USDC_ADDRESSES: Record<number, string> = {
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',     // Ethereum
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',   // Base
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',   // Arbitrum
};

// CCTP V2 TokenMessenger addresses (mainnet)
const TOKEN_MESSENGER: Record<number, string> = {
  1: '0xBd3fa81B58Ba92a82136038B25aDec7066af3155',
  8453: '0x1682Ae6375C4E4A97e4B583BC394c861A46D8962',
  42161: '0x19330d10D9Cc8751218eaf51E8885D058642E08A',
};

// CCTP domain IDs
const CCTP_DOMAINS: Record<number, number> = {
  1: 0,     // Ethereum
  8453: 6,  // Base
  42161: 3, // Arbitrum
};

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  8453: 'Base',
  42161: 'Arbitrum',
};

const RPC_URLS: Record<number, string> = {
  1: 'https://ethereum-rpc.publicnode.com',
  8453: 'https://mainnet.base.org',
  42161: 'https://arbitrum-one-rpc.publicnode.com',
};

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
];

const TOKEN_MESSENGER_ABI = [
  'function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken) returns (uint64)',
];

export type ArcChainId = 1 | 8453 | 42161;

export interface BridgeParams {
  sourceChainId: ArcChainId;
  destChainId: ArcChainId;
  amount: string; // USDC amount in human-readable (e.g., "0.10")
  recipient: `0x${string}`;
  provider: BrowserProvider;
}

export interface BridgeResult {
  approveTxHash: string;
  bridgeTxHash: string;
  sourceChain: string;
  destChain: string;
  amount: string;
}

export type BridgeStatus = 'switching' | 'approving' | 'bridging' | 'waiting' | 'completed';

/**
 * Bridge USDC from one chain to another using Circle CCTP (Arc).
 * Uses ethers.js with the connected wallet provider.
 */
export async function bridgeUSDC(
  params: BridgeParams,
  onStatus?: (status: BridgeStatus) => void,
): Promise<BridgeResult> {
  const { sourceChainId, destChainId, amount, recipient, provider } = params;

  const usdcAddress = USDC_ADDRESSES[sourceChainId];
  const messengerAddress = TOKEN_MESSENGER[sourceChainId];
  const destDomain = CCTP_DOMAINS[destChainId];

  if (!usdcAddress || !messengerAddress || destDomain === undefined) {
    throw new Error('Missing contract addresses for bridge');
  }

  console.log('Arc bridge:', { sourceChainId, destChainId, amount, recipient });
  // Use the provider as-is — the caller must ensure the wallet
  // is already on the correct source chain before calling this.
  let ethersProvider: BrowserProvider;
  if (provider instanceof BrowserProvider) {
    ethersProvider = provider;
  } else {
    ethersProvider = new BrowserProvider(provider as any);
  }

  onStatus?.('approving');
  const signer = await ethersProvider.getSigner();
  console.log('Arc bridge: signer on', CHAIN_NAMES[sourceChainId]);

  const rpcProvider = new JsonRpcProvider(RPC_URLS[sourceChainId]);
  const usdcAmount = parseUnits(amount, 6);
  const mintRecipient = '0x000000000000000000000000' + recipient.slice(2);

  // Step 1: Approve USDC
  onStatus?.('approving');
  console.log('Approving USDC on', CHAIN_NAMES[sourceChainId], '...');
  const usdc = new Contract(usdcAddress, ERC20_ABI, signer);
  const approveTx = await usdc.approve(messengerAddress, usdcAmount);
  console.log('Approve tx:', approveTx.hash);
  await rpcProvider.waitForTransaction(approveTx.hash, 1, 120_000);

  // Step 2: Deposit for burn
  onStatus?.('bridging');
  console.log('Depositing for burn...');
  const messenger = new Contract(messengerAddress, TOKEN_MESSENGER_ABI, signer);
  const bridgeTx = await messenger.depositForBurn(
    usdcAmount,
    destDomain,
    mintRecipient,
    usdcAddress,
  );
  console.log('Bridge tx:', bridgeTx.hash);
  await rpcProvider.waitForTransaction(bridgeTx.hash, 1, 120_000);

  // Step 3: CCTP attestation (~1-2 min on mainnet)
  onStatus?.('waiting');
  onStatus?.('completed');

  return {
    approveTxHash: approveTx.hash,
    bridgeTxHash: bridgeTx.hash,
    sourceChain: CHAIN_NAMES[sourceChainId] || `Chain ${sourceChainId}`,
    destChain: CHAIN_NAMES[destChainId] || `Chain ${destChainId}`,
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

  const rpcProvider = new JsonRpcProvider(RPC_URLS[chainId]);
  const usdc = new Contract(usdcAddress, ERC20_ABI, rpcProvider);
  const balance = await usdc.balanceOf(address);

  const num = Number(balance) / 1e6;
  return num.toFixed(2);
}

export { CHAIN_NAMES, USDC_ADDRESSES };
