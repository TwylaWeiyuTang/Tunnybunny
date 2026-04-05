import { StyleSheet, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { Text, View } from '@/components/Themed';
import { useGroupStore } from '@/store/groups';
import { useExpenseStore } from '@/store/expenses';
import { useWalletStore } from '@/store/wallet';

const AVATAR_COLORS = ['#6C5CE7', '#00b894', '#e17055', '#0984e3', '#fdcb6e', '#e84393', '#00cec9', '#d63031'];

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getGroup } = useGroupStore();
  const { getExpensesForGroup, getDebtsForGroup } = useExpenseStore();

  const group = getGroup(id);
  const rawExpenses = getExpensesForGroup(id);
  // Deduplicate by ID (local + backend sync can create duplicates)
  const expenses = rawExpenses.filter(
    (e, i, arr) => arr.findIndex((x) => x.id === e.id) === i,
  );
  const debts = getDebtsForGroup(id);
  const { address: myAddress } = useWalletStore();

  // Helper to display member name
  const memberName = (addr: string) => {
    if (addr.toLowerCase() === myAddress?.toLowerCase()) return 'You';
    const member = group?.members.find((m) => m.address.toLowerCase() === addr.toLowerCase());
    const name = member?.displayName && member.displayName !== 'You' ? member.displayName : undefined;
    return name || `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (!group) {
    return (
      <View style={styles.container}>
        <Text>Group not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.groupName}>{group.name}</Text>
        <Text style={styles.memberCount}>
          {group.members.length} member{group.members.length !== 1 ? 's' : ''}
        </Text>

        {/* Members */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Members</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.membersScroll}>
            {group.members.map((member, i) => {
              const isYou = member.address.toLowerCase() === myAddress?.toLowerCase();
              const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
              // Never use stored "You" as a real display name
              const displayName = member.displayName && member.displayName !== 'You'
                ? member.displayName
                : undefined;
              const label = isYou ? 'You' : displayName || `${member.address.slice(0, 6)}...${member.address.slice(-4)}`;
              const initial = isYou ? 'Y' : displayName
                ? displayName[0].toUpperCase()
                : member.address.slice(2, 4).toUpperCase();

              return (
                <View key={member.address} style={styles.memberChip}>
                  <View style={[styles.memberAvatar, { backgroundColor: color }]}>
                    <Text style={styles.memberInitial}>{initial}</Text>
                  </View>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {label}
                  </Text>
                  {displayName && !isYou && (
                    <Text style={styles.memberAddr} numberOfLines={1}>
                      {member.address.slice(0, 6)}...{member.address.slice(-4)}
                    </Text>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* Balances Summary */}
        {debts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Balances</Text>
            {debts.map((debt, i) => (
              <View key={i} style={styles.debtRow}>
                <Text style={styles.debtText}>
                  {memberName(debt.from)} owes {memberName(debt.to)}
                </Text>
                <Text style={styles.debtAmount}>${(debt.amount / 100).toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Expenses */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expenses</Text>
        </View>

        {expenses.length === 0 ? (
          <View style={styles.emptyExpenses}>
            <Text style={styles.emptyText}>No expenses yet</Text>
          </View>
        ) : (
          expenses.map((item) => (
            <View key={item.id} style={styles.expenseCard}>
              <View style={styles.expenseInfo}>
                <View style={styles.expenseDescRow}>
                  <Text style={styles.expenseDesc}>{item.description}</Text>
                  {item.splitType === 'roulette' && (
                    <View style={styles.rouletteBadge}>
                      <FontAwesome name="random" size={10} color="#d63031" />
                    </View>
                  )}
                </View>
                <Text style={styles.expensePayer}>
                  Paid by {memberName(item.paidBy)}
                  {item.splitType === 'roulette' ? ' · Roulette split' : ''}
                </Text>
              </View>
              <Text style={styles.expenseAmount}>
                ${(item.amount / 100).toFixed(2)}
              </Text>
            </View>
          ))
        )}

        {/* Spacer for FAB */}
        <View style={{ height: 80, backgroundColor: 'transparent' }} />
      </ScrollView>

      <View style={styles.fabRow}>
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={() =>
            router.push({
              pathname: '/group/share',
              params: { groupId: id },
            })
          }
        >
          <FontAwesome name="qrcode" size={20} color="#6C5CE7" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.fab}
          onPress={() =>
            router.push({
              pathname: '/group/add-expense',
              params: { groupId: id },
            })
          }
        >
          <FontAwesome name="plus" size={20} color="#fff" />
          <Text style={styles.fabText}>Add Expense</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  groupName: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  memberCount: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  section: {
    marginTop: 24,
    backgroundColor: 'transparent',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  membersScroll: {
    marginHorizontal: -4,
  },
  memberChip: {
    alignItems: 'center',
    width: 72,
    marginHorizontal: 4,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  memberInitial: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  memberName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  memberAddr: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
    fontFamily: 'SpaceMono',
  },
  debtRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  debtText: {
    fontSize: 14,
    flex: 1,
  },
  debtAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#d63031',
  },
  emptyExpenses: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: 'transparent',
  },
  emptyText: {
    color: '#999',
  },
  expenseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    backgroundColor: 'transparent',
  },
  expenseInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  expenseDescRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'transparent',
  },
  expenseDesc: {
    fontSize: 15,
    fontWeight: '500',
  },
  rouletteBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#d6303118',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expensePayer: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  fabRow: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'transparent',
  },
  shareBtn: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#6C5CE7',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  fab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6C5CE7',
    padding: 16,
    borderRadius: 12,
  },
  fabText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
