import { useEffect, useCallback, useState } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Link, router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { Text, View } from '@/components/Themed';
import { useGroupStore } from '@/store/groups';
import { useWalletStore } from '@/store/wallet';

export default function GroupsScreen() {
  const { groups, removeGroup, fetchGroupsFromBackend } = useGroupStore();
  const { address } = useWalletStore();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!address) return;
    setRefreshing(true);
    await fetchGroupsFromBackend(address);
    setRefreshing(false);
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const confirmDelete = (id: string, name: string) => {
    Alert.alert('Delete Group', `Are you sure you want to delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeGroup(id) },
    ]);
  };

  const renderRightActions = (id: string, name: string) => (
    <TouchableOpacity
      style={styles.deleteBtn}
      onPress={() => confirmDelete(id, name)}
    >
      <FontAwesome name="trash" size={20} color="#fff" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {groups.length === 0 ? (
        <View style={styles.empty}>
          <FontAwesome name="users" size={48} color="#ccc" />
          <Text style={styles.emptyText}>No groups yet</Text>
          <Text style={styles.emptySubtext}>
            Create a group to start splitting bills with friends
          </Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#6C5CE7" />
          }
          renderItem={({ item }) => (
            <Swipeable renderRightActions={() => renderRightActions(item.id, item.name)}>
              <TouchableOpacity
                style={styles.groupCard}
                onPress={() => router.push(`/group/${item.id}`)}
              >
                <View style={styles.groupInfo}>
                  <Text style={styles.groupName}>{item.name}</Text>
                  <Text style={styles.groupMembers}>
                    {item.members.length} member{item.members.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <FontAwesome name="chevron-right" size={16} color="#999" />
              </TouchableOpacity>
            </Swipeable>
          )}
        />
      )}

      <View style={styles.fabRow}>
        <TouchableOpacity
          style={styles.joinBtn}
          onPress={() => router.push('/group/join')}
        >
          <FontAwesome name="qrcode" size={22} color="#6C5CE7" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/group/create')}
        >
          <FontAwesome name="plus" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'transparent',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  groupInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
  },
  groupMembers: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  deleteBtn: {
    backgroundColor: '#d63031',
    justifyContent: 'center',
    alignItems: 'center',
    width: 70,
    borderRadius: 12,
    marginBottom: 8,
  },
  fabRow: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  joinBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#6C5CE7',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6C5CE7',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
