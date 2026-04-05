import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, TextInput, TouchableOpacity, ScrollView,
  Alert, Switch, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { Contract, BrowserProvider, JsonRpcProvider } from 'ethers';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useProvider } from '@reown/appkit-react-native';

import { Text, View } from '@/components/Themed';
import { useGroupStore } from '@/store/groups';
import { useExpenseStore } from '@/store/expenses';
import { useWalletStore } from '@/store/wallet';
import {
  ROULETTE_ADDRESS,
  ROULETTE_ABI,
  USDC_ARB,
} from '@/constants/contracts';

const rpcProvider = new JsonRpcProvider('https://arbitrum-one-rpc.publicnode.com');

export default function AddExpenseScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { getGroup } = useGroupStore();
  const { addExpense, syncExpenseToBackend } = useExpenseStore();
  const { address } = useWalletStore();
  const { provider: walletProvider } = useProvider();

  const group = getGroup(groupId);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>(
    group?.members.map((m) => m.address) || []
  );
  const [roulette, setRoulette] = useState(false);
  const [vrfStatus, setVrfStatus] = useState<
    'idle' | 'signing' | 'waiting-vrf' | 'done' | 'failed'
  >('idle');
  const [rouletteShares, setRouletteShares] = useState<Record<string, number>>({});
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const toggleMember = (addr: string) => {
    setSelectedMembers((prev) =>
      prev.includes(addr)
        ? prev.filter((a) => a !== addr)
        : [...prev, addr]
    );
    // Reset roulette if members change
    if (vrfStatus === 'done') {
      setVrfStatus('idle');
      setRouletteShares({});
    }
  };

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const triggerRoulette = async () => {
    if (!walletProvider) {
      Alert.alert('Error', 'Wallet not connected');
      return;
    }
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      Alert.alert('Error', 'Please enter a valid amount first');
      return;
    }
    if (selectedMembers.length < 2) {
      Alert.alert('Error', 'Need at least 2 members for roulette');
      return;
    }

    setVrfStatus('signing');

    try {
      const provider = new BrowserProvider(walletProvider as any);
      const signer = await provider.getSigner();
      const contract = new Contract(ROULETTE_ADDRESS, ROULETTE_ABI, signer);

      // Convert USD cents to USDC 6-decimal (1 cent = 10000 raw units)
      const amountRaw = (amountCents * 10000).toString();

      const tx = await contract.createSession(
        address, // merchant = payer (doesn't matter for expense tracking)
        amountRaw,
        selectedMembers,
      );

      setVrfStatus('waiting-vrf');

      // Wait for tx confirmation via direct RPC
      await rpcProvider.waitForTransaction(tx.hash, 1, 60_000);

      // Parse session ID from receipt
      const receipt = await rpcProvider.getTransactionReceipt(tx.hash);
      const readContract = new Contract(ROULETTE_ADDRESS, ROULETTE_ABI, rpcProvider);
      const event = receipt!.logs.find(
        (log: any) => {
          try { return readContract.interface.parseLog(log)?.name === 'SessionCreated'; }
          catch { return false; }
        },
      );
      const parsed = readContract.interface.parseLog(event!);
      const sessionId = Number(parsed!.args[0]);

      // Poll for VRF fulfillment
      pollRef.current = setInterval(async () => {
        try {
          const assigned = await readContract.areSharesAssigned(sessionId);
          if (!assigned) return;

          clearInterval(pollRef.current!);

          // Fetch shares
          const shares: Record<string, number> = {};
          const totalRaw = BigInt(amountRaw);
          let sumShares = BigInt(0);

          for (const addr of selectedMembers) {
            const share = await readContract.getShare(sessionId, addr);
            const shareNum = Number(share);
            shares[addr] = shareNum;
            sumShares += BigInt(shareNum);
          }

          // Convert raw USDC shares back to USD cents
          const sharesCents: Record<string, number> = {};
          for (const addr of selectedMembers) {
            sharesCents[addr] = Math.round(shares[addr] / 10000);
          }

          setRouletteShares(sharesCents);
          setVrfStatus('done');
        } catch (err) {
          console.warn('Poll error:', err);
        }
      }, 3000);
    } catch (err: any) {
      console.warn('Roulette error:', err.message);
      setVrfStatus('failed');
      Alert.alert('Error', 'Failed to create roulette session. Try again.');
    }
  };

  const submit = () => {
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (selectedMembers.length === 0) {
      Alert.alert('Error', 'Please select at least one member to split with');
      return;
    }
    if (roulette && vrfStatus !== 'done') {
      Alert.alert('Error', 'Please spin the roulette first to assign random shares');
      return;
    }

    const paidBy = address || group?.creator || '0x0';

    const expense = {
      id: randomUUID(),
      groupId,
      amount: amountCents,
      description: description.trim(),
      paidBy,
      splitAmong: selectedMembers,
      splitType: roulette ? 'roulette' as const : 'equal' as const,
      shares: roulette ? rouletteShares : undefined,
      createdAt: Date.now(),
    };

    addExpense(expense);
    syncExpenseToBackend(expense);
    router.back();
  };

  if (!group) {
    return (
      <View style={styles.container}>
        <Text>Group not found</Text>
      </View>
    );
  }

  const amountNum = parseFloat(amount);
  const validAmount = !isNaN(amountNum) && amountNum > 0;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.label}>Description</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., Dinner, Taxi, Hotel"
        value={description}
        onChangeText={setDescription}
        autoFocus
      />

      <Text style={styles.label}>Amount (USD)</Text>
      <TextInput
        style={styles.input}
        placeholder="0.00"
        value={amount}
        onChangeText={(v) => {
          setAmount(v);
          if (vrfStatus === 'done') {
            setVrfStatus('idle');
            setRouletteShares({});
          }
        }}
        keyboardType="decimal-pad"
      />

      <Text style={styles.label}>Split Among</Text>
      {group.members.map((member) => {
        const isMe = member.address.toLowerCase() === address?.toLowerCase();
        const displayName = member.displayName && member.displayName !== 'You'
          ? member.displayName : undefined;
        return (
          <TouchableOpacity
            key={member.address}
            style={[
              styles.memberRow,
              selectedMembers.includes(member.address) && styles.memberSelected,
            ]}
            onPress={() => toggleMember(member.address)}
          >
            <Text style={styles.memberAddress}>
              {isMe ? 'You' : displayName || `${member.address.slice(0, 6)}...${member.address.slice(-4)}`}
            </Text>
            {selectedMembers.includes(member.address) && (
              <Text style={styles.checkmark}>✓</Text>
            )}
          </TouchableOpacity>
        );
      })}

      {/* Roulette Toggle */}
      <View style={styles.rouletteRow}>
        <View style={styles.rouletteInfo}>
          <FontAwesome name="random" size={18} color="#d63031" />
          <View style={styles.rouletteText}>
            <Text style={styles.rouletteLabel}>Roulette Mode</Text>
            <Text style={styles.rouletteDesc}>
              Random split via Chainlink VRF on-chain
            </Text>
          </View>
        </View>
        <Switch
          value={roulette}
          onValueChange={(v) => {
            setRoulette(v);
            if (!v) {
              setVrfStatus('idle');
              setRouletteShares({});
            }
          }}
          trackColor={{ false: '#e0e0e0', true: '#d63031' }}
          thumbColor="#fff"
        />
      </View>

      {/* Roulette spin button */}
      {roulette && vrfStatus === 'idle' && (
        <TouchableOpacity
          style={[styles.spinBtn, !validAmount && styles.spinBtnDisabled]}
          onPress={triggerRoulette}
          disabled={!validAmount}
        >
          <FontAwesome name="random" size={16} color="#fff" />
          <Text style={styles.spinBtnText}>Spin the Roulette</Text>
        </TouchableOpacity>
      )}

      {/* VRF signing */}
      {roulette && vrfStatus === 'signing' && (
        <View style={styles.vrfStatusRow}>
          <ActivityIndicator color="#d63031" />
          <Text style={styles.vrfStatusText}>Sign the transaction in your wallet...</Text>
        </View>
      )}

      {/* Waiting for VRF */}
      {roulette && vrfStatus === 'waiting-vrf' && (
        <View style={styles.vrfStatusRow}>
          <ActivityIndicator color="#d63031" />
          <Text style={styles.vrfStatusText}>Waiting for Chainlink VRF...</Text>
        </View>
      )}

      {/* Failed */}
      {roulette && vrfStatus === 'failed' && (
        <TouchableOpacity style={styles.spinBtn} onPress={triggerRoulette}>
          <FontAwesome name="refresh" size={16} color="#fff" />
          <Text style={styles.spinBtnText}>Retry Roulette</Text>
        </TouchableOpacity>
      )}

      {/* Split Preview */}
      {selectedMembers.length > 0 && validAmount && (
        <View style={styles.splitPreview}>
          {roulette && vrfStatus === 'done' ? (
            <View style={styles.rouletteResult}>
              <View style={styles.rouletteResultHeader}>
                <FontAwesome name="random" size={14} color="#d63031" />
                <Text style={styles.rouletteResultTitle}>Roulette Result</Text>
                <View style={styles.vrfBadge}>
                  <Text style={styles.vrfBadgeText}>Chainlink VRF</Text>
                </View>
              </View>
              {selectedMembers.map((addr, i) => {
                const isMe = addr.toLowerCase() === address?.toLowerCase();
                const member = group.members.find((m) => m.address.toLowerCase() === addr.toLowerCase());
                const displayName = member?.displayName && member.displayName !== 'You'
                  ? member.displayName : undefined;
                const share = rouletteShares[addr] || 0;
                const maxShare = Math.max(...Object.values(rouletteShares));
                const barWidth = maxShare > 0 ? (share / maxShare) * 100 : 0;
                return (
                  <View key={addr} style={styles.shareCard}>
                    <View style={styles.shareCardTop}>
                      <Text style={styles.shareName}>
                        {isMe ? 'You' : displayName || `${addr.slice(0, 6)}...${addr.slice(-4)}`}
                      </Text>
                      <Text style={[
                        styles.shareAmount,
                        share === 0 && styles.shareAmountFree,
                      ]}>
                        {share === 0 ? 'FREE!' : `$${(share / 100).toFixed(2)}`}
                      </Text>
                    </View>
                    <View style={styles.shareBar}>
                      <View style={[
                        styles.shareBarFill,
                        { width: `${barWidth}%` },
                        share === 0 && styles.shareBarFree,
                      ]} />
                    </View>
                  </View>
                );
              })}
            </View>
          ) : roulette ? (
            <>
              <FontAwesome name="question-circle" size={20} color="#d63031" />
              <Text style={[styles.splitPreviewText, { color: '#d63031' }]}>
                Spin the roulette to reveal shares
              </Text>
            </>
          ) : (
            <Text style={styles.splitPreviewText}>
              ${(amountNum / selectedMembers.length).toFixed(2)} per person
            </Text>
          )}
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.submitBtn,
          roulette && vrfStatus !== 'done' && styles.submitBtnDisabled,
        ]}
        onPress={submit}
        disabled={roulette && vrfStatus !== 'done'}
      >
        <Text style={styles.submitBtnText}>Add Expense</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 8,
  },
  memberSelected: {
    borderColor: '#6C5CE7',
    backgroundColor: '#6C5CE711',
  },
  memberAddress: {
    fontSize: 14,
    fontFamily: 'SpaceMono',
  },
  checkmark: {
    fontSize: 18,
    color: '#6C5CE7',
    fontWeight: '700',
  },
  rouletteRow: {
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
  rouletteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    backgroundColor: 'transparent',
  },
  rouletteText: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  rouletteLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#d63031',
  },
  rouletteDesc: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  spinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#d63031',
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  spinBtnDisabled: {
    opacity: 0.5,
  },
  spinBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  vrfStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 20,
    backgroundColor: 'transparent',
  },
  vrfStatusText: {
    fontSize: 14,
    color: '#d63031',
    fontWeight: '500',
  },
  splitPreview: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginTop: 16,
    gap: 8,
    alignItems: 'center',
  },
  splitPreviewText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6C5CE7',
    textAlign: 'center',
  },
  rouletteResult: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  rouletteResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    backgroundColor: 'transparent',
  },
  rouletteResultTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#d63031',
    flex: 1,
  },
  vrfBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#d6303118',
  },
  vrfBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#d63031',
  },
  shareCard: {
    marginBottom: 10,
    backgroundColor: 'transparent',
  },
  shareCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    backgroundColor: 'transparent',
  },
  shareName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  shareAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#6C5CE7',
  },
  shareAmountFree: {
    color: '#00b894',
  },
  shareBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e0e0e0',
    overflow: 'hidden',
  },
  shareBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#6C5CE7',
  },
  shareBarFree: {
    backgroundColor: '#00b894',
    width: '100%',
  },
  submitBtn: {
    backgroundColor: '#6C5CE7',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
