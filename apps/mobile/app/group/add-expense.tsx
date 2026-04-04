import { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';

import { Text, View } from '@/components/Themed';
import { useGroupStore } from '@/store/groups';
import { useExpenseStore } from '@/store/expenses';
import { useWalletStore } from '@/store/wallet';

export default function AddExpenseScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { getGroup } = useGroupStore();
  const { addExpense } = useExpenseStore();
  const { address } = useWalletStore();

  const group = getGroup(groupId);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>(
    group?.members.map((m) => m.address) || []
  );

  const toggleMember = (addr: string) => {
    setSelectedMembers((prev) =>
      prev.includes(addr)
        ? prev.filter((a) => a !== addr)
        : [...prev, addr]
    );
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

    const paidBy = address || group?.creator || '0x0';

    addExpense({
      id: randomUUID(),
      groupId,
      amount: amountCents,
      description: description.trim(),
      paidBy,
      splitAmong: selectedMembers,
      splitType: 'equal',
      createdAt: Date.now(),
    });

    router.back();
  };

  if (!group) {
    return (
      <View style={styles.container}>
        <Text>Group not found</Text>
      </View>
    );
  }

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
        onChangeText={setAmount}
        keyboardType="decimal-pad"
      />

      <Text style={styles.label}>Split Among</Text>
      {group.members.map((member) => (
        <TouchableOpacity
          key={member.address}
          style={[
            styles.memberRow,
            selectedMembers.includes(member.address) && styles.memberSelected,
          ]}
          onPress={() => toggleMember(member.address)}
        >
          <Text style={styles.memberAddress}>
            {member.displayName || `${member.address.slice(0, 6)}...${member.address.slice(-4)}`}
          </Text>
          {selectedMembers.includes(member.address) && (
            <Text style={styles.checkmark}>✓</Text>
          )}
        </TouchableOpacity>
      ))}

      {selectedMembers.length > 0 && amount && !isNaN(parseFloat(amount)) && (
        <View style={styles.splitPreview}>
          <Text style={styles.splitPreviewText}>
            ${(parseFloat(amount) / selectedMembers.length).toFixed(2)} per person
          </Text>
        </View>
      )}

      <TouchableOpacity style={styles.submitBtn} onPress={submit}>
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
  splitPreview: {
    padding: 16,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    marginTop: 16,
  },
  splitPreviewText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6C5CE7',
  },
  submitBtn: {
    backgroundColor: '#6C5CE7',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
