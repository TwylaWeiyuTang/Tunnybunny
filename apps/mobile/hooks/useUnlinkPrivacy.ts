import { useState, useCallback } from 'react';
import type { BrowserProvider } from 'ethers';
import {
  sendPrivatePayment,
  type PrivatePaymentResult,
} from '@/services/unlink/private';

interface UseUnlinkPrivacyResult {
  sendPrivate: (params: {
    provider: BrowserProvider;
    recipientUnlinkAddress: string;
    amount: string; // USDC in smallest unit (6 decimals)
  }) => Promise<PrivatePaymentResult>;
  isProcessing: boolean;
  result: PrivatePaymentResult | null;
  error: string | null;
}

/**
 * Hook for sending private payments via Unlink ZK proofs
 */
export function useUnlinkPrivacy(): UseUnlinkPrivacyResult {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<PrivatePaymentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sendPrivate = useCallback(
    async (params: {
      provider: BrowserProvider;
      recipientUnlinkAddress: string;
      amount: string;
    }) => {
      setIsProcessing(true);
      setError(null);
      setResult(null);

      try {
        // API key and mnemonic from env vars
        const apiKey = process.env.EXPO_PUBLIC_UNLINK_API_KEY || '';
        const mnemonic = process.env.EXPO_PUBLIC_UNLINK_MNEMONIC || '';

        if (!apiKey) {
          throw new Error('Unlink API key not configured. Get one from hackaton-apikey.vercel.app');
        }

        const paymentResult = await sendPrivatePayment({
          provider: params.provider,
          recipientUnlinkAddress: params.recipientUnlinkAddress,
          amount: params.amount,
          apiKey,
          mnemonic,
        });

        setResult(paymentResult);
        return paymentResult;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Private payment failed';
        setError(message);
        throw err;
      } finally {
        setIsProcessing(false);
      }
    },
    [],
  );

  return { sendPrivate, isProcessing, result, error };
}
