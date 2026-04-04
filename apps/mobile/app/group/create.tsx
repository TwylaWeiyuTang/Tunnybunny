import { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, FlatList, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { randomUUID } from 'expo-crypto';

import { Text, View } from '@/components/Themed';
import { useGroupStore, type GroupMember } from '@/store/groups';
import { useWalletStore } from '@/store/wallet';
import { isEnsName, resolveEnsName } from '@/services/ens/resolve';

export default function CreateGroupScreen() {
  const [name, setName] = useState('');
  const [memberInput, setMemberInput] = useState('');
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [resolving, setResolving] = useState(false);
  const { addGroup } = useGroupStore();
  const { address } = useWalletStore();

  const addMember = async () => {
    const trimmed = memberInput.trim();
    if (!trimmed) return;

    // Check if input is an ENS name
    if (isEnsName(trimmed)) {
      setResolving(true);
      try {
        const resolved = await resolveEnsName(trimmed);
        if (!resolved) {
          Alert.alert('ENS Not Found', `Could not resolve "${trimmed}" to an address`);
          return;
        }

        if (members.some((m) => m.address.toLowerCase() === resolved.toLowerCase())) {
          Alert.alert('Duplicate', `${trimmed} is already in the group`);
          return;
        }

        setMembers([...members, { address: resolved, displayName: trimmed }]);
        setMemberInput('');
      } catch {
        Alert.alert('Error', `Failed to resolve "${trimmed}"`);
      } finally {
        setResolving(false);
      }
      return;
    }

    // Raw address
    if (members.some((m) => m.address.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert('Duplicate', 'This address is already in the group');
      return;
    }

    setMembers([...members, { address: trimmed }]);
    setMemberInput('');
  };

  const removeMember = (addr: string) => {
    setMembers(members.filter((m) => m.address !== addr));
  };

  const createGroup = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    const creator = address || '0x0000000000000000000000000000000000000000';
    const group = {
      id: randomUUID(),
      name: name.trim(),
      creator,
      members: [{ address: creator, displayName: 'You' }, ...members],
      createdAt: Date.now(),
    };

    addGroup(group);
    router.back();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Group Name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., Summer Trip, Dinner at Mario's"
        value={name}
        onChangeText={setName}
        autoFocus
      />

      <Text style={styles.label}>Members</Text>
      <View style={styles.memberInputRow}>
        <TextInput
          style={[styles.input, styles.memberInput]}
          placeholder="ENS name or address (vitalik.eth, 0x...)"
          value={memberInput}
          onChangeText={setMemberInput}
          autoCapitalize="none"
          editable={!resolving}
        />
        <TouchableOpacity
          style={[styles.addBtn, resolving && styles.addBtnDisabled]}
          onPress={addMember}
          disabled={resolving}
        >
          {resolving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <FontAwesome name="plus" size={16} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={members}
        keyExtractor={(item) => item.address}
        style={styles.memberList}
        renderItem={({ item }) => (
          <View style={styles.memberRow}>
            <View style={styles.memberInfo}>
              {item.displayName ? (
                <>
                  <Text style={styles.ensName}>{item.displayName}</Text>
                  <Text style={styles.memberAddress} numberOfLines={1}>
                    {item.address.slice(0, 6)}...{item.address.slice(-4)}
                  </Text>
                </>
              ) : (
                <Text style={styles.memberAddress} numberOfLines={1}>
                  {item.address.slice(0, 6)}...{item.address.slice(-4)}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={() => removeMember(item.address)}>
              <FontAwesome name="times" size={16} color="#d63031" />
            </TouchableOpacity>
          </View>
        )}
      />

      <TouchableOpacity style={styles.createBtn} onPress={createGroup}>
        <Text style={styles.createBtnText}>Create Group</Text>
      </TouchableOpacity>
    </View>
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
  memberInputRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'transparent',
  },
  memberInput: {
    flex: 1,
  },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#6C5CE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    opacity: 0.7,
  },
  memberList: {
    marginTop: 12,
    maxHeight: 240,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    backgroundColor: 'transparent',
  },
  memberInfo: {
    flex: 1,
    marginRight: 12,
    backgroundColor: 'transparent',
  },
  ensName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6C5CE7',
  },
  memberAddress: {
    fontFamily: 'SpaceMono',
    fontSize: 13,
    color: '#999',
  },
  createBtn: {
    backgroundColor: '#6C5CE7',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 16,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
