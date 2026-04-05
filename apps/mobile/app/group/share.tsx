import { StyleSheet, TouchableOpacity, Share } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import QRCode from 'react-native-qrcode-svg';

import { Text, View } from '@/components/Themed';
import { useGroupStore } from '@/store/groups';
import { useExpenseStore } from '@/store/expenses';

/**
 * Generates a QR code containing the full group + expenses data
 * so another member can scan it and import the group into their app.
 *
 * Payload: { app: "tunnybunny-group", group: Group, expenses: Expense[] }
 */
export default function ShareGroupScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { getGroup } = useGroupStore();
  const { getExpensesForGroup } = useExpenseStore();

  const group = getGroup(groupId);
  const expenses = getExpensesForGroup(groupId);

  if (!group) {
    return (
      <View style={styles.container}>
        <Text>Group not found</Text>
      </View>
    );
  }

  // Slim down the payload to fit in a QR code
  // Only include essential expense fields, truncate descriptions
  const slimExpenses = expenses.map((e) => ({
    id: e.id,
    groupId: e.groupId,
    amount: e.amount,
    description: e.description.slice(0, 30),
    paidBy: e.paidBy,
    splitAmong: e.splitAmong,
    splitType: e.splitType,
    shares: e.shares,
    createdAt: e.createdAt,
  }));

  // Slim group — only essential fields
  const slimGroup = {
    id: group.id,
    name: group.name,
    creator: group.creator,
    members: group.members.map((m) => ({
      address: m.address,
      ...(m.displayName ? { displayName: m.displayName } : {}),
    })),
    createdAt: group.createdAt,
  };

  // Cap at 10 most recent expenses to keep QR readable
  const cappedExpenses = slimExpenses.slice(0, 10);
  const payload = JSON.stringify({
    app: 'tunnybunny-group',
    group: slimGroup,
    expenses: cappedExpenses,
  });

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Share Group</Text>
        <Text style={styles.groupName}>{group.name}</Text>
        <Text style={styles.memberCount}>
          {group.members.length} member{group.members.length !== 1 ? 's' : ''} &middot;{' '}
          {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
        </Text>

        <View style={styles.qrContainer}>
          <QRCode
            value={payload}
            size={220}
            backgroundColor="white"
            color="#1a1a2e"
          />
        </View>

        <Text style={styles.hint}>
          Ask group members to scan this QR code{'\n'}inside TunnyBunny to join the group
        </Text>
      </View>

      <TouchableOpacity
        style={styles.shareBtn}
        onPress={() =>
          Share.share({
            message: `Join my TunnyBunny group "${group.name}"!\n\n${payload}`,
          })
        }
      >
        <FontAwesome name="share" size={16} color="#6C5CE7" />
        <Text style={styles.shareBtnText}>Share via Message</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  groupName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#6C5CE7',
  },
  memberCount: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
    marginBottom: 24,
  },
  qrContainer: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'white',
    marginBottom: 20,
  },
  hint: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6C5CE7',
  },
  shareBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6C5CE7',
  },
});
