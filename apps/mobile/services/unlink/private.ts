import type { BrowserProvider } from 'ethers';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { createUnlinkClient, type UnlinkClient } from './client';

// USDC on Base Sepolia
const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

export interface PrivatePaymentParams {
  provider: BrowserProvider;
  recipientUnlinkAddress: string; // unlink1... address
  tokenAddress?: string; // defaults to USDC on Base Sepolia
  amount: string; // in token's smallest unit
  apiKey: string;
  mnemonic: string;
}

export interface PrivatePaymentResult {
  txId: string;
  status: 'confirmed' | 'pending';
  method: 'unlink-zk';
}

/**
 * Execute a private payment flow:
 * 1. Deposit USDC into Unlink privacy pool
 * 2. Transfer privately to recipient's Unlink address
 *
 * Sender and recipient identities are shielded via ZK proofs.
 */
export async function sendPrivatePayment(
  params: PrivatePaymentParams,
): Promise<PrivatePaymentResult> {
  const {
    provider,
    recipientUnlinkAddress,
    tokenAddress = USDC_BASE_SEPOLIA,
    amount,
    apiKey,
    mnemonic,
  } = params;

  const unlink = await createUnlinkClient(provider, apiKey, mnemonic);
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(baseSepolia.rpcUrls.default.http[0]),
  });

  // Step 1: Ensure ERC-20 approval for the Unlink pool
  const approval = await unlink.ensureErc20Approval({
    token: tokenAddress,
    amount,
  });

  if (approval.status === 'submitted') {
    await publicClient.waitForTransactionReceipt({
      hash: approval.txHash as `0x${string}`,
    });
  }

  // Step 2: Deposit into privacy pool
  const deposit = await unlink.deposit({
    token: tokenAddress,
    amount,
  });

  await unlink.pollTransactionStatus(deposit.txId);

  // Step 3: Private transfer to recipient
  const transfer = await unlink.transfer({
    recipientAddress: recipientUnlinkAddress,
    token: tokenAddress,
    amount,
  });

  const confirmed = await unlink.pollTransactionStatus(transfer.txId);

  return {
    txId: transfer.txId,
    status: 'confirmed',
    method: 'unlink-zk',
  };
}

/**
 * Withdraw from Unlink privacy pool back to a standard EVM address.
 * Used by the recipient to claim their private payment.
 */
export async function withdrawToEvm(
  unlink: UnlinkClient,
  recipientEvmAddress: string,
  tokenAddress: string = USDC_BASE_SEPOLIA,
  amount: string,
): Promise<{ txId: string }> {
  const result = await unlink.withdraw({
    recipientEvmAddress,
    token: tokenAddress,
    amount,
  });

  await unlink.pollTransactionStatus(result.txId);

  return { txId: result.txId };
}
