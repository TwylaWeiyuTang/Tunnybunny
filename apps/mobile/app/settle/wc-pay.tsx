import { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { BrowserProvider, Contract, JsonRpcProvider } from 'ethers';
import { useProvider } from '@reown/appkit-react-native';
import { randomUUID } from 'expo-crypto';

import { Text, View } from '@/components/Themed';
import { useWalletStore } from '@/store/wallet';
import { useExpenseStore } from '@/store/expenses';
import { useGroupStore } from '@/store/groups';
import { useSettlementStore } from '@/store/settlement';
import { useSplitSessionStore } from '@/store/splitSession';
import { getWcPayActions, confirmWcPayment } from '@/services/walletconnect/pos';

const WC_PAY_API_KEY = process.env.EXPO_PUBLIC_WC_PAY_API_KEY || '';
const GATEWAY_BASE = 'https://api.pay.walletconnect.com';

type FlowState = 'kyc' | 'fetching-options' | 'signing' | 'confirming' | 'done' | 'failed';

export default function WcPayScreen() {
  const {
    paymentId,
    collectUrl,
    amountRaw,
    merchantName,
    groupId,
    groupName,
    roulette: rouletteParam,
  } = useLocalSearchParams<{
    paymentId: string;
    collectUrl: string;
    amountRaw: string;
    merchantName: string;
    groupId: string;
    groupName: string;
    roulette: string;
  }>();

  const isRoulette = rouletteParam === 'true';

  const { address } = useWalletStore();
  const { provider: walletProvider } = useProvider();
  const { addExpense } = useExpenseStore();
  const { getGroup } = useGroupStore();
  const { setSession: setSplitSession } = useSplitSessionStore();
  const [flowState, setFlowState] = useState<FlowState>('kyc');
  const [error, setError] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);

  const amountUsdc = (parseInt(amountRaw || '0') / 1e6).toFixed(2);

  const kycHandled = useRef(false);

  // Listen for IC_COMPLETE from the WebView
  const handleMessage = async (event: any) => {
    const raw = event.nativeEvent.data;
    console.log('WebView message:', raw);

    // Parse if JSON
    let data = raw;
    try { data = JSON.parse(raw); } catch {}
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);

    // Only trigger on explicit IC_COMPLETE
    if (dataStr.includes('IC_COMPLETE')) {
      if (!kycHandled.current) {
        kycHandled.current = true;
        await handleKycComplete();
      }
    }
  };

  const handleKycComplete = async () => {
    if (flowState !== 'kyc') return; // prevent double-trigger
    if (!address || !walletProvider) {
      Alert.alert('Error', 'Wallet not connected');
      return;
    }

    setFlowState('fetching-options');

    try {
      // Re-fetch options now that KYC is done
      const optionsRes = await fetch(
        `${GATEWAY_BASE}/v1/gateway/payment/${paymentId}/options`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Api-Key': WC_PAY_API_KEY,
          },
          body: JSON.stringify({
            accounts: [
              `eip155:42161:${address}`,
              `eip155:8453:${address}`,
              `eip155:1:${address}`,
            ],
          }),
        },
      );

      if (!optionsRes.ok) {
        throw new Error(`Options request failed: ${optionsRes.status}`);
      }

      const optionsData = await optionsRes.json();
      console.log('WC Pay options after KYC:', JSON.stringify(optionsData, null, 2));

      const options = optionsData.options || [];
      if (options.length === 0) {
        throw new Error('No payment options available after KYC');
      }

      const option = options[0];
      const optionId = option.id;
      const actions = option.actions || [];

      // Decode build actions — the data field is hex-encoded JSON
      const resolvedActions: any[] = [];
      for (const action of actions) {
        if (action.type === 'build' && action.data?.data) {
          // Hex string → JSON
          const hexStr = action.data.data;
          const jsonStr = Buffer.from(hexStr, 'hex').toString('utf-8');
          const decoded = JSON.parse(jsonStr);
          console.log('Decoded build action:', JSON.stringify(decoded, null, 2));
          resolvedActions.push({ type: 'walletRpc', ...decoded });
        } else {
          resolvedActions.push(action);
        }
      }

      console.log('Resolved actions:', JSON.stringify(resolvedActions, null, 2));

      if (resolvedActions.length === 0) {
        throw new Error('No signable actions returned. The payment may have expired — try scanning a fresh QR.');
      }

      // Sign the transactions
      setFlowState('signing');
      const provider = new BrowserProvider(walletProvider as any);
      const signer = await provider.getSigner();
      const results: any[] = [];

      for (const action of resolvedActions) {
        const method = action.method;
        const params = action.params;

        if (method === 'eth_sendTransaction') {
          const tx = await signer.sendTransaction(params[0]);
          const rpcProvider = new JsonRpcProvider('https://arbitrum-one-rpc.publicnode.com');
          await rpcProvider.waitForTransaction(tx.hash, 1, 120_000);
          results.push({ type: 'walletRpc', data: [tx.hash] });
        } else if (method === 'eth_signTypedData_v4') {
          // EIP-712 signing — params[1] is a JSON string
          const typedData = typeof params[1] === 'string' ? JSON.parse(params[1]) : params[1];
          const { domain, types, message } = typedData;
          // Remove EIP712Domain from types (ethers adds it automatically)
          delete types.EIP712Domain;
          const sig = await signer.signTypedData(domain, types, message);
          results.push({ type: 'walletRpc', data: [sig] });
        } else {
          console.warn('Unknown method:', method);
        }
      }

      if (results.length === 0) {
        throw new Error('No transactions were signed. Payment not completed.');
      }

      // Confirm with Gateway
      setFlowState('confirming');
      const confirmRes = await fetch(
        `${GATEWAY_BASE}/v1/gateway/payment/${paymentId}/confirm?maxPollMs=10000`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Api-Key': WC_PAY_API_KEY,
          },
          body: JSON.stringify({
            optionId,
            results,
            collectedData: null, // KYC was done via WebView
          }),
        },
      );

      if (!confirmRes.ok) {
        const errText = await confirmRes.text();
        console.warn('WC Pay confirm error:', confirmRes.status, errText);
        throw new Error(`Payment confirmation failed (${confirmRes.status}). Your signature was submitted but the merchant may not have received it.`);
      } else {
        const confirmData = await confirmRes.json();
        console.log('WC Pay confirm:', JSON.stringify(confirmData, null, 2));

        // Poll until final
        if (!confirmData.isFinal && confirmData.pollInMs) {
          let attempts = 0;
          while (attempts < 10) {
            await new Promise((r) => setTimeout(r, confirmData.pollInMs || 3000));
            const pollRes = await fetch(
              `${GATEWAY_BASE}/v1/gateway/payment/${paymentId}/confirm?maxPollMs=5000`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Api-Key': WC_PAY_API_KEY,
                },
                body: JSON.stringify({ optionId, results }),
              },
            );
            if (pollRes.ok) {
              const pollData = await pollRes.json();
              if (pollData.isFinal) break;
            }
            attempts++;
          }
        }
      }

      // Record as group expense split among all members
      const group = getGroup(groupId || '');
      const members = group?.members.map((m) => m.address) || [address];
      const amountCents = Math.round(parseInt(amountRaw || '0') / 10000); // raw USDC to cents
      addExpense({
        id: randomUUID(),
        groupId: groupId || '',
        amount: amountCents,
        description: `${merchantName || 'Merchant'} (WC Pay)`,
        paidBy: address,
        splitAmong: members,
        splitType: isRoulette ? 'roulette' : 'equal',
        createdAt: Date.now(),
      });

      // If roulette, set up a reimbursement session so the payer gets paid back
      if (isRoulette && group && members.length >= 2) {
        // Include all members for VRF (contract requires 2+),
        // but mark the payer as already deposited so they don't pay again
        setSplitSession({
          id: randomUUID(),
          contractSessionId: null,
          merchantAddress: address, // payer receives reimbursement
          totalAmountRaw: amountRaw || '0',
          groupId: group.id,
          groupName: group.name,
          participants: members.map((m) => ({
            address: m,
            shareAmount: 0, // VRF will assign
            status: m.toLowerCase() === address.toLowerCase()
              ? 'deposited' as const  // payer already paid
              : 'pending' as const,
          })),
          status: 'creating',
          roulette: true,
          wcPaymentId: null,
          createdAt: Date.now(),
        });
      }

      setFlowState('done');
    } catch (err: any) {
      console.warn('WC Pay flow error:', err.message);
      setError(err.message);
      setFlowState('failed');
    }
  };

  // Inject JS to listen for postMessage in the WebView
  const injectedJs = `
    window.addEventListener('message', function(e) {
      window.ReactNativeWebView.postMessage(JSON.stringify(e.data));
    });
    true;
  `;

  if (flowState === 'done') {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <FontAwesome name="check-circle" size={64} color="#00b894" />
          <Text style={styles.successText}>Payment Complete!</Text>
          <Text style={styles.successDetail}>
            ${amountUsdc} paid to {merchantName || 'merchant'}
          </Text>
          <View style={styles.wcBadge}>
            <FontAwesome name="wifi" size={12} color="#6C5CE7" />
            <Text style={styles.wcBadgeText}>via WalletConnect Pay</Text>
          </View>
          <Text style={styles.expenseNote}>
            Expense added to {groupName || 'group'}.
            {isRoulette
              ? ' Tap below to start the roulette — Chainlink VRF will randomly assign shares!'
              : ' Other members can now reimburse you via the Settle tab.'}
          </Text>
          {isRoulette ? (
            <TouchableOpacity
              style={styles.rouletteBtn}
              onPress={() => {
                router.dismissAll();
                setTimeout(() => router.push('/settle/split-status'), 100);
              }}
            >
              <FontAwesome name="random" size={16} color="#fff" />
              <Text style={styles.doneBtnText}>Start Roulette Reimbursement</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => router.dismissAll()}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  if (flowState === 'failed') {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <FontAwesome name="times-circle" size={64} color="#d63031" />
          <Text style={styles.errorText}>Payment Failed</Text>
          <Text style={styles.errorDetail}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              setFlowState('kyc');
              setError(null);
            }}
          >
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (flowState !== 'kyc') {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6C5CE7" />
          <Text style={styles.processingText}>
            {flowState === 'fetching-options' && 'Getting payment options...'}
            {flowState === 'signing' && 'Sign the transaction in your wallet...'}
            {flowState === 'confirming' && 'Confirming payment with merchant...'}
          </Text>
        </View>
      </View>
    );
  }

  // KYC WebView
  console.log('WC Pay screen state:', { flowState, collectUrl: collectUrl?.slice(0, 80), paymentId });

  if (!collectUrl) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <FontAwesome name="exclamation-circle" size={48} color="#f0932b" />
          <Text style={styles.processingText}>
            No verification URL available.{'\n'}The payment may have expired — scan a new QR.
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => router.back()}
          >
            <Text style={styles.retryBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{merchantName || 'Merchant'}</Text>
        <Text style={styles.headerAmount}>${amountUsdc}</Text>
        <View style={styles.wcBadge}>
          <FontAwesome name="wifi" size={10} color="#6C5CE7" />
          <Text style={styles.wcBadgeText}>WalletConnect Pay</Text>
        </View>
      </View>
      <WebView
        ref={webViewRef}
        source={{ uri: collectUrl || '' }}
        style={styles.webview}
        onMessage={handleMessage}
        injectedJavaScript={injectedJs}
        originWhitelist={['https://*']}
        onError={(e) => console.warn('WebView error:', e.nativeEvent)}
        onHttpError={(e) => console.warn('WebView HTTP error:', e.nativeEvent)}
        onLoadStart={(e) => console.log('WebView loading:', e.nativeEvent.url)}
        onShouldStartLoadWithRequest={(request) => {
          console.log('WebView request:', request.url);
          // Allow about:blank (used by iframes/JS)
          if (request.url === 'about:blank') return true;
          // Keep navigation within https
          if (request.url.startsWith('https://')) return true;
          // Block deep links that would navigate away
          console.log('WebView blocked external nav:', request.url);
          return false;
        }}
        onNavigationStateChange={(navState) => {
          console.log('WebView nav:', navState.url);
        }}
      />
      <TouchableOpacity
        style={styles.skipBtn}
        onPress={() => {
          Alert.alert(
            'Verification Complete?',
            'Only tap this after you\'ve submitted the form above. If verification wasn\'t completed, the payment will fail.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Continue to Payment', onPress: () => handleKycComplete() },
            ],
          );
        }}
      >
        <Text style={styles.skipBtnText}>I've completed verification</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: 'transparent',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#6C5CE7',
    marginTop: 4,
  },
  wcBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#6C5CE722',
  },
  wcBadgeText: {
    fontSize: 11,
    color: '#6C5CE7',
    fontWeight: '600',
  },
  webview: {
    flex: 1,
  },
  skipBtn: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
  skipBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6C5CE7',
  },
  processingText: {
    fontSize: 16,
    color: '#6C5CE7',
    fontWeight: '500',
    marginTop: 16,
    textAlign: 'center',
  },
  successText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#00b894',
    marginTop: 16,
  },
  successDetail: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  expenseNote: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 20,
  },
  doneBtn: {
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 32,
  },
  rouletteBtn: {
    backgroundColor: '#d63031',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 32,
  },
  doneBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#d63031',
    marginTop: 16,
  },
  errorDetail: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  retryBtn: {
    borderWidth: 1,
    borderColor: '#6C5CE7',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 32,
  },
  retryBtnText: {
    color: '#6C5CE7',
    fontSize: 16,
    fontWeight: '700',
  },
});
