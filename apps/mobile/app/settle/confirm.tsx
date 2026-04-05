import { StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { Text, View } from '@/components/Themed';
import { useSettlement } from '@/hooks/useSettlement';

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  8453: 'Base',
  42161: 'Arbitrum',
  84532: 'Base Sepolia',
  11155111: 'Ethereum Sepolia',
  421614: 'Arbitrum Sepolia',
};

export default function ConfirmPaymentScreen() {
  const {
    amount,
    to,
    tokenSymbol,
    sourceChain,
    destChain,
    isPrivate,
    status,
    txHash,
    error,
    execute,
    reset,
  } = useSettlement();

  const amountUsd = (amount / 100).toFixed(2);
  const needsSwap = tokenSymbol !== 'USDC';
  const needsBridge = sourceChain !== destChain;
  const isProcessing = !['idle', 'completed', 'failed'].includes(status);

  // Success state
  if (status === 'completed') {
    return (
      <View style={styles.container}>
        <View style={styles.successContainer}>
          <FontAwesome name="check-circle" size={64} color="#00b894" />
          <Text style={styles.successText}>Payment Complete!</Text>
          <Text style={styles.successDetail}>
            ${amountUsd} sent to {to?.slice(0, 6)}...{to?.slice(-4)}
          </Text>
          {txHash && (
            <Text style={styles.txHash}>
              Tx: {txHash.slice(0, 10)}...{txHash.slice(-8)}
            </Text>
          )}
          {isPrivate && (
            <View style={styles.privacyBadge}>
              <FontAwesome name="eye-slash" size={12} color="#6C5CE7" />
              <Text style={styles.privacyBadgeText}>Paid Privately via Unlink</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => {
              reset();
              router.dismissAll();
            }}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Error state
  if (status === 'failed') {
    return (
      <View style={styles.container}>
        <View style={styles.successContainer}>
          <FontAwesome name="times-circle" size={64} color="#d63031" />
          <Text style={styles.errorText}>Payment Failed</Text>
          <Text style={styles.errorDetail}>{error || 'Unknown error'}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => reset()}
          >
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Payment Summary</Text>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <SummaryRow label="Amount" value={`$${amountUsd}`} />
        <SummaryRow label="Token" value={tokenSymbol} />
        <SummaryRow label="From Chain" value={CHAIN_NAMES[sourceChain] || `Chain ${sourceChain}`} />
        <SummaryRow label="To Chain" value={CHAIN_NAMES[destChain] || `Chain ${destChain}`} />
        <SummaryRow label="Recipient" value={`${to?.slice(0, 6)}...${to?.slice(-4)}`} />
        {isPrivate && <SummaryRow label="Privacy" value="Unlink ZK (Private)" highlight />}
      </View>

      {/* Transaction Steps */}
      <View style={styles.stepsContainer}>
        <Text style={styles.stepsTitle}>Transaction Steps</Text>
        {needsSwap && (
          <StepRow
            step={1}
            label={`Swap ${tokenSymbol} -> USDC via Uniswap`}
            active={status === 'swapping'}
            done={['bridging', 'settling', 'completed'].includes(status)}
          />
        )}
        {needsBridge && (
          <StepRow
            step={needsSwap ? 2 : 1}
            label={`Bridge USDC via Arc (${CHAIN_NAMES[sourceChain]} -> ${CHAIN_NAMES[destChain]})`}
            active={status === 'bridging'}
            done={['settling', 'completed'].includes(status)}
          />
        )}
        <StepRow
          step={(needsSwap ? 1 : 0) + (needsBridge ? 1 : 0) + 1}
          label={isPrivate ? 'Settle privately via Unlink' : 'Send USDC via WalletConnect Pay'}
          active={status === 'settling'}
          done={status === 'completed'}
        />
      </View>

      {/* Integration badges */}
      <View style={styles.badgesRow}>
        {needsSwap && <Badge label="Uniswap" icon="exchange" />}
        {needsBridge && <Badge label="Arc" icon="random" />}
        <Badge label="WalletConnect" icon="wifi" />
        {isPrivate && <Badge label="Unlink" icon="eye-slash" />}
      </View>

      {/* Pay Button */}
      <TouchableOpacity
        style={[styles.payBtn, isProcessing && styles.payBtnDisabled]}
        onPress={execute}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <View style={styles.processingRow}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.payBtnText}>
              {status === 'swapping' && 'Swapping via Uniswap...'}
              {status === 'bridging' && 'Bridging via Arc...'}
              {status === 'settling' && 'Settling payment...'}
              {status === 'quoting' && 'Getting quote...'}
            </Text>
          </View>
        ) : (
          <Text style={styles.payBtnText}>
            Confirm & Pay ${amountUsd}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, highlight && styles.summaryHighlight]}>{value}</Text>
    </View>
  );
}

function StepRow({ step, label, active, done }: { step: number; label: string; active: boolean; done?: boolean }) {
  return (
    <View style={styles.stepRow}>
      <View style={[
        styles.stepCircle,
        active && styles.stepCircleActive,
        done && styles.stepCircleDone,
      ]}>
        {active ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : done ? (
          <FontAwesome name="check" size={12} color="#fff" />
        ) : (
          <Text style={styles.stepNumber}>{step}</Text>
        )}
      </View>
      <Text style={[
        styles.stepLabel,
        active && styles.stepLabelActive,
        done && styles.stepLabelDone,
      ]}>{label}</Text>
    </View>
  );
}

function Badge({ label, icon }: { label: string; icon: string }) {
  return (
    <View style={styles.integrationBadge}>
      <FontAwesome name={icon as any} size={10} color="#6C5CE7" />
      <Text style={styles.integrationBadgeText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  summaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 16,
    marginBottom: 24,
    backgroundColor: 'transparent',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#999',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryHighlight: {
    color: '#6C5CE7',
  },
  stepsContainer: {
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  stepsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: '#6C5CE7',
  },
  stepCircleDone: {
    backgroundColor: '#00b894',
  },
  stepNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  stepLabel: {
    fontSize: 14,
    flex: 1,
  },
  stepLabelActive: {
    fontWeight: '600',
    color: '#6C5CE7',
  },
  stepLabelDone: {
    color: '#00b894',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
    backgroundColor: 'transparent',
  },
  integrationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#6C5CE711',
  },
  integrationBadgeText: {
    fontSize: 11,
    color: '#6C5CE7',
    fontWeight: '600',
  },
  payBtn: {
    backgroundColor: '#6C5CE7',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 32,
  },
  payBtnDisabled: {
    opacity: 0.8,
  },
  payBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'transparent',
  },
  // Success
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  successText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#00b894',
    marginTop: 16,
  },
  successDetail: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  txHash: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'SpaceMono',
    marginTop: 8,
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#6C5CE711',
    marginTop: 12,
  },
  privacyBadgeText: {
    fontSize: 12,
    color: '#6C5CE7',
    fontWeight: '600',
  },
  doneBtn: {
    backgroundColor: '#6C5CE7',
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
  // Error
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
    paddingHorizontal: 32,
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
