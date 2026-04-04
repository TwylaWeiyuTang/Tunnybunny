import { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { Text, View } from '@/components/Themed';
import { useSettlementStore } from '@/store/settlement';
import { useWalletStore } from '@/store/wallet';
import { getUsdcBalance } from '@/services/arc/bridge';
import type { ArcChainId } from '@/services/arc/client';

const CHAINS = [
  { id: 84532 as ArcChainId, name: 'Base Sepolia', icon: 'circle' as const },
  { id: 11155111 as ArcChainId, name: 'Ethereum Sepolia', icon: 'diamond' as const },
  { id: 421614 as ArcChainId, name: 'Arbitrum Sepolia', icon: 'bolt' as const },
];

export default function SettlementFlowScreen() {
  const { id, from, to, amount } = useLocalSearchParams<{
    id: string;
    from: string;
    to: string;
    amount: string;
  }>();

  const {
    sourceChain,
    tokenSymbol,
    isPrivate,
    setSettlement,
    setPrivate,
  } = useSettlementStore();
  const { address } = useWalletStore();

  // Fetch USDC balances per chain via Arc
  const [balances, setBalances] = useState<Record<number, string>>({});
  useEffect(() => {
    if (!address) return;
    CHAINS.forEach(async (chain) => {
      try {
        const bal = await getUsdcBalance(chain.id, address as `0x${string}`);
        setBalances((prev) => ({ ...prev, [chain.id]: bal }));
      } catch {
        setBalances((prev) => ({ ...prev, [chain.id]: '...' }));
      }
    });
  }, [address]);

  const amountUsd = (parseInt(amount || '0') / 100).toFixed(2);

  return (
    <View style={styles.container}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Paying</Text>
        <Text style={styles.summaryAmount}>${amountUsd}</Text>
        <Text style={styles.summaryDetail}>
          To: {to?.slice(0, 6)}...{to?.slice(-4)}
        </Text>
      </View>

      {/* Token Selection */}
      <TouchableOpacity
        style={styles.optionRow}
        onPress={() => {
          setSettlement({ groupId: id, from, to, amount: parseInt(amount || '0') });
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

      {/* Chain Selection */}
      <Text style={styles.sectionTitle}>Pay from chain</Text>
      {CHAINS.map((chain) => (
        <TouchableOpacity
          key={chain.id}
          style={[
            styles.chainRow,
            sourceChain === chain.id && styles.chainSelected,
          ]}
          onPress={() => setSettlement({ sourceChain: chain.id })}
        >
          <FontAwesome name={chain.icon} size={16} color={sourceChain === chain.id ? '#6C5CE7' : '#999'} />
          <View style={styles.chainInfo}>
            <Text style={[
              styles.chainName,
              sourceChain === chain.id && styles.chainNameSelected,
            ]}>
              {chain.name}
            </Text>
            {balances[chain.id] !== undefined && (
              <Text style={styles.chainBalance}>
                {balances[chain.id]} USDC
              </Text>
            )}
          </View>
          {sourceChain === chain.id && (
            <FontAwesome name="check" size={16} color="#6C5CE7" />
          )}
        </TouchableOpacity>
      ))}

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
        style={styles.confirmBtn}
        onPress={() => {
          setSettlement({ groupId: id, from, to, amount: parseInt(amount || '0') });
          router.push('/settle/confirm');
        }}
      >
        <Text style={styles.confirmBtnText}>
          Review Payment
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  summaryCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#6C5CE711',
    alignItems: 'center',
    marginBottom: 24,
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
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 24,
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
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  chainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 8,
    gap: 12,
  },
  chainSelected: {
    borderColor: '#6C5CE7',
    backgroundColor: '#6C5CE711',
  },
  chainInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  chainName: {
    fontSize: 15,
  },
  chainNameSelected: {
    fontWeight: '600',
    color: '#6C5CE7',
  },
  chainBalance: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginTop: 16,
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
  confirmBtn: {
    backgroundColor: '#6C5CE7',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 16,
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
