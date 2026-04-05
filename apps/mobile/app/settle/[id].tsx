import { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, Switch, ActivityIndicator, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { Text, View } from '@/components/Themed';
import { useSettlementStore } from '@/store/settlement';
import { useWalletStore } from '@/store/wallet';
import {
  getAggregatedBalance,
  computeRoute,
  type ChainBalance,
  type RoutePlan,
} from '@/services/arc/router';

export default function SettlementFlowScreen() {
  const { id, from, to, amount } = useLocalSearchParams<{
    id: string;
    from: string;
    to: string;
    amount: string;
  }>();

  const {
    tokenSymbol,
    isPrivate,
    setSettlement,
    setPrivate,
  } = useSettlementStore();
  const { address } = useWalletStore();

  const [balances, setBalances] = useState<ChainBalance[]>([]);
  const [route, setRoute] = useState<RoutePlan | null>(null);
  const [loading, setLoading] = useState(true);

  const amountCents = parseInt(amount || '0');
  const amountUsd = (amountCents / 100).toFixed(2);
  const amountNum = amountCents / 100;

  // Fetch aggregated USDC balance across all chains
  useEffect(() => {
    if (!address) return;
    setLoading(true);
    getAggregatedBalance(address as `0x${string}`)
      .then((bals) => {
        setBalances(bals);
        const plan = computeRoute(bals, amountNum);
        setRoute(plan);
        // Auto-set source chain to the primary route step
        if (plan.steps.length > 0) {
          setSettlement({ sourceChain: plan.steps[0].chainId });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address, amountNum]);

  const totalBalance = balances.reduce((s, b) => s + b.balance, 0);
  const hasEnough = totalBalance >= amountNum;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Paying</Text>
        <Text style={styles.summaryAmount}>${amountUsd}</Text>
        <Text style={styles.summaryDetail}>
          To: {to?.slice(0, 6)}...{to?.slice(-4)}
        </Text>
      </View>

      {/* Unified USDC Balance (chain abstracted) */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceHeader}>
          <FontAwesome name="database" size={16} color="#6C5CE7" />
          <Text style={styles.balanceTitle}>Your USDC Liquidity</Text>
        </View>
        {loading ? (
          <ActivityIndicator color="#6C5CE7" style={{ marginVertical: 12 }} />
        ) : (
          <>
            <Text style={styles.totalBalance}>${totalBalance.toFixed(2)}</Text>
            <Text style={styles.totalBalanceLabel}>across {balances.filter(b => b.balance > 0).length} chains</Text>
            <View style={styles.chainBreakdown}>
              {balances.map((b) => (
                <View key={b.chainId} style={styles.chainPill}>
                  <View style={[styles.chainDot, b.balance > 0 && styles.chainDotActive]} />
                  <Text style={styles.chainPillText}>
                    {b.chainName.replace(' Sepolia', '')}: ${b.balance.toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>

      {/* Smart Route (auto-computed) */}
      {route && !loading && (
        <View style={styles.routeCard}>
          <View style={styles.routeHeader}>
            <FontAwesome name="random" size={14} color="#6C5CE7" />
            <Text style={styles.routeTitle}>Auto-Route via Arc</Text>
          </View>
          {route.steps.map((step, i) => {
            const isLocal = step.chainId === route.settlementChain;
            return (
              <View key={step.chainId} style={styles.routeStep}>
                <View style={[styles.routeStepDot, isLocal ? styles.routeStepDotLocal : styles.routeStepDotBridge]} />
                <View style={styles.routeStepInfo}>
                  <Text style={styles.routeStepText}>
                    ${step.amount.toFixed(2)} from {step.chainName.replace(' Sepolia', '')}
                  </Text>
                  <Text style={styles.routeStepHint}>
                    {isLocal ? 'Direct transfer' : 'Bridge via Arc CCTP'}
                  </Text>
                </View>
                {!isLocal && (
                  <FontAwesome name="arrow-right" size={12} color="#6C5CE7" />
                )}
              </View>
            );
          })}
          {route.steps.length > 1 && (
            <Text style={styles.routeNote}>
              Arc aggregates your USDC across chains into one payment
            </Text>
          )}
          {!route.needsBridge && (
            <Text style={styles.routeNote}>
              No bridging needed — USDC already on settlement chain
            </Text>
          )}
        </View>
      )}

      {/* Token Selection */}
      <TouchableOpacity
        style={styles.optionRow}
        onPress={() => {
          setSettlement({ groupId: id, from, to, amount: amountCents });
          router.push('/settle/token-select');
        }}
      >
        <View style={styles.optionLeft}>
          <FontAwesome name="exchange" size={18} color="#6C5CE7" />
          <Text style={styles.optionLabel}>Pay with</Text>
        </View>
        <View style={styles.optionRight}>
          <Text style={styles.optionValue}>{tokenSymbol}</Text>
          <FontAwesome name="chevron-right" size={14} color="#999" />
        </View>
      </TouchableOpacity>

      {/* Privacy Toggle */}
      <View style={styles.privacyRow}>
        <View style={styles.privacyInfo}>
          <FontAwesome name="eye-slash" size={18} color="#6C5CE7" />
          <View style={styles.privacyText}>
            <Text style={styles.privacyLabel}>Pay Privately</Text>
            <Text style={styles.privacyDesc}>
              Shield sender & amount via Unlink ZK proofs
            </Text>
          </View>
        </View>
        <Switch
          value={isPrivate}
          onValueChange={setPrivate}
          trackColor={{ false: '#e0e0e0', true: '#6C5CE7' }}
          thumbColor="#fff"
        />
      </View>

      {/* Confirm Button */}
      <TouchableOpacity
        style={[styles.confirmBtn, !hasEnough && styles.confirmBtnDisabled]}
        disabled={!hasEnough || loading}
        onPress={() => {
          setSettlement({
            groupId: id,
            from,
            to,
            amount: amountCents,
            // Use first route step as source chain; settlement hook handles multi-step
            sourceChain: route?.steps[0]?.chainId ?? 42161,
          });
          router.push('/settle/confirm');
        }}
      >
        <Text style={styles.confirmBtnText}>
          {!hasEnough ? 'Insufficient USDC' : 'Review Payment'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  summaryCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#6C5CE711',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#999',
  },
  summaryAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: '#6C5CE7',
    marginTop: 4,
  },
  summaryDetail: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
    fontFamily: 'SpaceMono',
  },

  // Unified balance card
  balanceCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  balanceTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
  },
  totalBalance: {
    fontSize: 28,
    fontWeight: '800',
    color: '#00b894',
  },
  totalBalanceLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
  },
  chainBreakdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: 'transparent',
  },
  chainPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  chainDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ccc',
  },
  chainDotActive: {
    backgroundColor: '#00b894',
  },
  chainPillText: {
    fontSize: 12,
    color: '#666',
  },

  // Route card
  routeCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#6C5CE708',
    borderWidth: 1,
    borderColor: '#6C5CE733',
    marginBottom: 16,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  routeTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6C5CE7',
    textTransform: 'uppercase',
  },
  routeStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    backgroundColor: 'transparent',
  },
  routeStepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeStepDotLocal: {
    backgroundColor: '#00b894',
  },
  routeStepDotBridge: {
    backgroundColor: '#6C5CE7',
  },
  routeStepInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  routeStepText: {
    fontSize: 14,
    fontWeight: '600',
  },
  routeStepHint: {
    fontSize: 11,
    color: '#999',
  },
  routeNote: {
    fontSize: 11,
    color: '#6C5CE7',
    marginTop: 8,
    fontStyle: 'italic',
  },

  // Token select
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 16,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
  },
  optionLabel: {
    fontSize: 15,
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'transparent',
  },
  optionValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6C5CE7',
  },

  // Privacy
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  privacyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    backgroundColor: 'transparent',
  },
  privacyText: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  privacyLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  privacyDesc: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },

  // Confirm
  confirmBtn: {
    backgroundColor: '#6C5CE7',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: '#ccc',
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
