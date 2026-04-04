import { StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { Text, View } from '@/components/Themed';
import { useGroupStore } from '@/store/groups';
import { useExpenseStore } from '@/store/expenses';

export default function SettleScreen() {
  const { groups } = useGroupStore();
  const { getDebtsForGroup } = useExpenseStore();

  // Collect all debts across all groups
  const allDebts = groups.flatMap((group) => {
    const debts = getDebtsForGroup(group.id);
    return debts.map((debt) => ({ ...debt, groupId: group.id, groupName: group.name }));
  });

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Settle Up</Text>
        <TouchableOpacity
          style={styles.scanBtn}
          onPress={() => router.push('/settle/scan')}
        >
          <FontAwesome name="qrcode" size={18} color="#fff" />
          <Text style={styles.scanBtnText}>Scan to Pay</Text>
        </TouchableOpacity>
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
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.debtCard}
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
                  {shortenAddress(item.from)} owes {shortenAddress(item.to)}
                </Text>
              </View>
              <View style={styles.debtActions}>
                <Text style={styles.amountText}>
                  ${(item.amount / 100).toFixed(2)}
                </Text>
                <View style={styles.actionBtns}>
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
                  <Text style={styles.settleText}>Settle</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
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
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 14,
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
});
