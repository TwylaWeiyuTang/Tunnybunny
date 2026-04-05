import { useCallback } from 'react';
import { Platform } from 'react-native';
import { BrowserProvider } from 'ethers';
import { useSettlementStore } from '@/store/settlement';
import { useWalletStore } from '@/store/wallet';
import { executePayment } from '@/services/walletconnect/pay';
import { executeSwap } from '@/services/uniswap/swap';
import { getUsdcAddress } from '@/services/uniswap/tokens';
import { bridgeUSDC, type ArcChainId } from '@/services/arc/bridge';
import { sendPrivatePayment } from '@/services/unlink/private';

// Conditionally import AppKit hook (only available on native)
let useAppKitProvider: () => { provider: unknown };
if (Platform.OS !== 'web') {
  useAppKitProvider = require('@reown/appkit-react-native').useProvider;
} else {
  useAppKitProvider = () => ({ provider: null });
}

/**
 * Orchestrates the full settlement flow:
 * 1. Swap via Uniswap (if token != USDC)
 * 2. Bridge via Arc (if source chain != dest chain)
 * 3. Transfer via WalletConnect Pay (or Unlink for private)
 */
export function useSettlement() {
  const { provider } = useAppKitProvider();
  const { address } = useWalletStore();
  const store = useSettlementStore();

  const execute = useCallback(async () => {
    if (!provider || !store.to || !store.amount || !address) {
      store.setSettlement({ error: 'Missing wallet connection or payment details' });
      store.setStatus('failed');
      return;
    }

    try {
      const ethersProvider = new BrowserProvider(provider as any);
      const needsSwap = store.tokenSymbol !== 'USDC';
      const needsBridge = store.sourceChain !== store.destChain;

      // Step 1: Swap if paying with non-USDC token via Uniswap API
      if (needsSwap) {
        store.setStatus('swapping');
        const swapResult = await executeSwap({
          tokenSymbol: store.tokenSymbol,
          amountCents: store.amount,
          chainId: store.sourceChain,
          swapperAddress: address,
          provider: ethersProvider,
        });
        store.setSettlement({ txHash: swapResult.txHash });
      }

      // Step 2: Bridge USDC cross-chain via Arc (Circle CCTP)
      if (needsBridge) {
        store.setStatus('bridging');
        const usdcHumanAmount = (store.amount / 100).toFixed(2);
        const bridgeResult = await bridgeUSDC({
          sourceChainId: store.sourceChain as ArcChainId,
          destChainId: store.destChain as ArcChainId,
          amount: usdcHumanAmount,
          recipient: store.to as `0x${string}`,
          provider: ethersProvider,
        });
        store.setSettlement({ txHash: bridgeResult.bridgeTxHash });
      }

      // Step 3: Execute final USDC payment
      store.setStatus('settling');

      if (store.isPrivate) {
        // Private payment via Unlink ZK proofs
        const usdcAmount = (store.amount * 10_000).toString(); // cents to 6-decimal USDC
        const apiKey = process.env.EXPO_PUBLIC_UNLINK_API_KEY || '';
        const mnemonic = process.env.EXPO_PUBLIC_UNLINK_MNEMONIC || '';

        const privateResult = await sendPrivatePayment({
          provider: ethersProvider,
          recipientUnlinkAddress: store.to, // recipient's Unlink address
          amount: usdcAmount,
          apiKey,
          mnemonic,
        });

        store.setSettlement({ txHash: privateResult.txId });
        store.setStatus('completed');
      } else {
        // Transfer USDC to recipient via WalletConnect Pay
        const usdcAddress = getUsdcAddress(store.destChain);
        if (!usdcAddress) throw new Error('USDC not available on destination chain');

        const usdcAmount = (store.amount * 10_000).toString(); // cents to 6-decimal USDC
        const result = await executePayment(ethersProvider, {
          to: store.to,
          amount: usdcAmount,
          tokenAddress: usdcAddress,
          chainId: store.destChain,
        });

        store.setSettlement({ txHash: result.txHash });

        if (result.status !== 'success') {
          throw new Error('Payment transaction failed');
        }

        store.setStatus('completed');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      store.setSettlement({ error: message });
      store.setStatus('failed');
    }
  }, [provider, address, store]);

  return {
    execute,
    ...store,
  };
}
