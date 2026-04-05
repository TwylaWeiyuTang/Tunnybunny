import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { Text, View } from '@/components/Themed';
import { useGroupStore } from '@/store/groups';
import { useExpenseStore, type Debt } from '@/store/expenses';
import { useWalletStore } from '@/store/wallet';

type DebtWithGroup = Debt & { groupId: string; groupName: string };

export default function SettleScreen() {
  const { groups, fetchGroupsFromBackend } = useGroupStore();
  const { getDebtsForGroup, fetchDebtsFromBackend, fetchExpensesFromBackend } = useExpenseStore();
  const { address } = useWalletStore();
  const [remoteDebts, setRemoteDebts] = useState<DebtWithGroup[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch groups and debts from backend on mount + pull-to-refresh
  const refresh = useCallback(async () => {
    if (!address) return;
    setRefreshing(true);
    try {
      // Fetch any groups this user belongs to (created by others)
      await fetchGroupsFromBackend(address);

      // Fetch debts from backend for all groups
      const currentGroups = useGroupStore.getState().groups;
      const allRemote: DebtWithGroup[] = [];

      await Promise.all(
        currentGroups.map(async (group) => {
          // Sync expenses from backend
          await fetchExpensesFromBackend(group.id);
          // Fetch server-computed debts
          const debts = await fetchDebtsFromBackend(group.id);
          for (const d of debts) {
            allRemote.push({ ...d, groupId: group.id, groupName: group.name });
          }
        }),
      );

      setRemoteDebts(allRemote);
    } catch (err) {
      console.warn('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Use backend debts if available, otherwise fall back to local calculation
  const localDebts: DebtWithGroup[] = groups.flatMap((group) => {
    const debts = getDebtsForGroup(group.id);
    return debts.map((debt) => ({ ...debt, groupId: group.id, groupName: group.name }));
  });

  const allDebts = remoteDebts.length > 0 ? remoteDebts : localDebts;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Settle Up</Text>
        <View style={styles.headerBtns}>
          <TouchableOpacity
            style={styles.splitBillBtn}
            onPress={() =>
              router.push({
                pathname: '/settle/split-scan',
                params: {
                  merchantAddress: address || '0x0000000000000000000000000000000000000000',
                  amountRaw: '100000', // $0.10 USDC default for testing
                  chainId: '42161',
                },
              })
            }
          >
            <FontAwesome name="scissors" size={14} color="#6C5CE7" />
            <Text style={styles.splitBillBtnText}>Split Bill</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.scanBtn}
            onPress={() => router.push('/settle/scan')}
          >
            <FontAwesome name="qrcode" size={18} color="#fff" />
            <Text style={styles.scanBtnText}>Scan</Text>
          </TouchableOpacity>
        </View>
      </View>

      {allDebts.length === 0 ? (
        <View style={styles.empty}>
          <FontAwesome name="check-circle" size={48} color="#00b894" />
          <Text style={styles.emptyText}>All settled up!</Text>
          <Text style={styles.emptySubtext}>
            No outstanding balances across your groups
          </Text>
        </View>
      ) : (
        <FlatList
          data={allDebts}
          keyExtractor={(_, index) => `debt-${index}`}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#6C5CE7" />
          }
          renderItem={({ item }) => {
            const isDebtor = address?.toLowerCase() === item.from.toLowerCase();
            const isCreditor = address?.toLowerCase() === item.to.toLowerCase();

            return (
              <TouchableOpacity
                style={styles.debtCard}
                disabled={!isDebtor}
                onPress={() =>
                  router.push({
                    pathname: '/settle/[id]',
                    params: {
                      id: item.groupId,
                      from: item.from,
                      to: item.to,
                      amount: item.amount.toString(),
                    },
                  })
                }
              >
                <View style={styles.debtInfo}>
                  <Text style={styles.debtGroup}>{item.groupName}</Text>
                  <Text style={styles.debtDetail}>
                    {isDebtor ? 'You owe' : isCreditor ? 'You are owed by' : shortenAddress(item.from) + ' owes'}{' '}
                    {isDebtor ? shortenAddress(item.to) : isCreditor ? shortenAddress(item.from) : shortenAddress(item.to)}
                  </Text>
                </View>
                <View style={styles.debtActions}>
                  <Text style={[styles.amountText, isCreditor && styles.amountTextCredit]}>
                    {isCreditor ? '+' : '-'}${(item.amount / 100).toFixed(2)}
                  </Text>
                  <View style={styles.actionBtns}>
                    {isCreditor && (
                      <TouchableOpacity
                        style={styles.requestBtn}
                        onPress={(e) => {
                          e.stopPropagation();
                          router.push({
                            pathname: '/settle/request',
                            params: { amount: item.amount.toString(), groupId: item.groupId },
                          });
                        }}
                      >
                        <FontAwesome name="qrcode" size={12} color="#6C5CE7" />
                        <Text style={styles.requestText}>Request</Text>
                      </TouchableOpacity>
                    )}
                    {isDebtor && (
                      <Text style={styles.settleText}>Settle</Text>
                    )}
                    {isCreditor && (
                      <Text style={styles.awaitingText}>Awaiting</Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

function shortenAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: 'transparent',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerBtns: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'transparent',
  },
  splitBillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#6C5CE7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  splitBillBtnText: {
    color: '#6C5CE7',
    fontSize: 13,
    fontWeight: '600',
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  scanBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    color: '#00b894',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  list: {
    padding: 16,
  },
  debtCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'transparent',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  debtInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  debtGroup: {
    fontSize: 13,
    color: '#999',
  },
  debtDetail: {
    fontSize: 15,
    fontWeight: '500',
    marginTop: 2,
  },
  debtActions: {
    alignItems: 'flex-end',
    backgroundColor: 'transparent',
  },
  amountText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#d63031',
  },
  amountTextCredit: {
    color: '#00b894',
  },
  actionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
    backgroundColor: 'transparent',
  },
  requestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'transparent',
  },
  requestText: {
    fontSize: 12,
    color: '#6C5CE7',
    fontWeight: '600',
  },
  settleText: {
    fontSize: 12,
    color: '#6C5CE7',
    fontWeight: '600',
  },
  awaitingText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
  },
});
