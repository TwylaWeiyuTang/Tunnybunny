import { type BrowserProvider, Contract } from 'ethers';

interface PaymentRequest {
  to: string;
  amount: string; // in token's smallest unit
  tokenAddress: string;
  chainId: number;
}

interface PaymentResult {
  txHash: string;
  status: 'success' | 'failed';
}

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
];

/**
 * Execute a payment via the connected wallet (WalletConnect Pay)
 * Uses the ethers provider from AppKit to send transactions
 */
export async function executePayment(
  provider: BrowserProvider,
  request: PaymentRequest
): Promise<PaymentResult> {
  const signer = await provider.getSigner();

  if (request.tokenAddress === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
    // Native ETH transfer
    const tx = await signer.sendTransaction({
      to: request.to,
      value: BigInt(request.amount),
    });
    const receipt = await tx.wait();
    return {
      txHash: receipt?.hash || tx.hash,
      status: receipt?.status === 1 ? 'success' : 'failed',
    };
  }

  // ERC-20 transfer
  const token = new Contract(request.tokenAddress, ERC20_ABI, signer);
  const tx = await token.transfer(request.to, BigInt(request.amount));
  const receipt = await tx.wait();

  return {
    txHash: receipt?.hash || tx.hash,
    status: receipt?.status === 1 ? 'success' : 'failed',
  };
}

/**
 * Approve a token for spending (needed for Uniswap swaps)
 */
export async function approveToken(
  provider: BrowserProvider,
  tokenAddress: string,
  spenderAddress: string,
  amount: string
): Promise<string> {
  const signer = await provider.getSigner();
  const token = new Contract(tokenAddress, ERC20_ABI, signer);
  const tx = await token.approve(spenderAddress, BigInt(amount));
  const receipt = await tx.wait();
  return receipt?.hash || tx.hash;
}

/**
 * Get token balance for connected wallet
 */
export async function getTokenBalance(
  provider: BrowserProvider,
  tokenAddress: string,
  walletAddress: string
): Promise<string> {
  if (tokenAddress === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
    const balance = await provider.getBalance(walletAddress);
    return balance.toString();
  }

  const token = new Contract(tokenAddress, ERC20_ABI, provider);
  const balance = await token.balanceOf(walletAddress);
  return balance.toString();
}
