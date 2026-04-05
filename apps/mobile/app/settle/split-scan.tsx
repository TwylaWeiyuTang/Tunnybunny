import { useState } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, Alert, Switch, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { randomUUID } from 'expo-crypto';

import { Text, View } from '@/components/Themed';
import { useGroupStore } from '@/store/groups';
import { useSplitSessionStore } from '@/store/splitSession';

/**
 * Split setup screen: reached after scanning a POS QR code.
 * Shows the total, lets user pick a group, displays per-member shares,
 * and creates the on-chain split session.
 */
export default function SplitScanScreen() {
  const { merchantAddress, merchantName, amountRaw, chainId, paymentId, collectUrl } = useLocalSearchParams<{
    merchantAddress: string;
    merchantName: string;
    amountRaw: string;
    chainId: string;
    paymentId: string;
    collectUrl: string;
  }>();

  const isWcPay = !!paymentId;

  const { groups } = useGroupStore();
  const { setSession } = useSplitSessionStore();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [roulette, setRoulette] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [editMerchant, setEditMerchant] = useState(merchantAddress || '');

  const amountUsdc = (parseInt(amountRaw || '0') / 1e6).toFixed(2);
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const memberCount = selectedGroup?.members.length || 0;
  const sharePerMember = memberCount > 0 ? Math.ceil(parseInt(amountRaw || '0') / memberCount) : 0;

  const handleCreateSplit = () => {
    if (!selectedGroup) {
      Alert.alert('Select a Group', 'Choose which group to split the bill with.');
      return;
    }
    if (!editMerchant || !editMerchant.startsWith('0x') || editMerchant.length < 42) {
      Alert.alert('Merchant Address', 'Please enter a valid merchant wallet address.');
      return;
    }

    const participants = selectedGroup.members.map((m) => ({
      address: m.address,
      displayName: m.displayName,
      shareAmount: roulette ? 0 : sharePerMember,
      status: 'pending' as const,
    }));

    setSession({
      id: randomUUID(),
      contractSessionId: null,
      merchantAddress: editMerchant,
      totalAmountRaw: amountRaw || '0',
      groupId: selectedGroup.id,
      groupName: selectedGroup.name,
      participants,
      status: 'creating',
      roulette,
      wcPaymentId: paymentId || null,
      createdAt: Date.now(),
    });

    router.replace('/settle/split-status');
  };

  const handlePayAndSplit = () => {
    if (!selectedGroup) {
      Alert.alert('Select a Group', 'Choose which group to split the bill with.');
      return;
    }

    router.push({
      pathname: '/settle/wc-pay',
      params: {
        paymentId,
        collectUrl: collectUrl || '',
        amountRaw: amountRaw || '0',
        merchantName: merchantName || '',
        groupId: selectedGroup.id,
        groupName: selectedGroup.name,
        roulette: roulette ? 'true' : 'false',
      },
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Payment Summary */}
      <View style={styles.summaryCard}>
        {merchantName ? (
          <Text style={styles.merchantNameText}>{merchantName}</Text>
        ) : null}
        <Text style={styles.summaryLabel}>Bill Total</Text>
        <Text style={styles.summaryAmount}>${amountUsdc}</Text>
        {paymentId ? (
          <View style={styles.wcBadge}>
            <FontAwesome name="wifi" size={10} color="#6C5CE7" />
            <Text style={styles.wcBadgeText}>WalletConnect Pay</Text>
          </View>
        ) : (
          <Text style={styles.merchantAddr}>
            To: {merchantAddress?.slice(0, 6)}...{merchantAddress?.slice(-4)}
          </Text>
        )}
      </View>

      {/* Merchant Address */}
      <Text style={styles.sectionTitle}>Merchant wallet</Text>
      <TextInput
        style={styles.merchantInput}
        placeholder="0x... (merchant's wallet address)"
        value={editMerchant}
        onChangeText={setEditMerchant}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/* Group Selection */}
      <Text style={styles.sectionTitle}>Split with group</Text>
      {groups.length === 0 ? (
        <View style={styles.emptyGroups}>
          <Text style={styles.emptyText}>No groups yet. Create one first.</Text>
        </View>
      ) : (
        groups.map((group) => (
          <TouchableOpacity
            key={group.id}
            style={[
              styles.groupRow,
              selectedGroupId === group.id && styles.groupRowSelected,
            ]}
            onPress={() => setSelectedGroupId(group.id)}
          >
            <View style={styles.groupInfo}>
              <Text
                style={[
                  styles.groupName,
                  selectedGroupId === group.id && styles.groupNameSelected,
                ]}
              >
                {group.name}
              </Text>
              <Text style={styles.groupMembers}>
                {group.members.length} members
              </Text>
            </View>
            {selectedGroupId === group.id && (
              <FontAwesome name="check" size={16} color="#6C5CE7" />
            )}
          </TouchableOpacity>
        ))
      )}

      {/* Roulette Toggle */}
      {selectedGroup && (
        <View style={styles.rouletteRow}>
          <View style={styles.rouletteInfo}>
            <FontAwesome name="random" size={18} color="#d63031" />
            <View style={styles.rouletteText}>
              <Text style={styles.rouletteLabel}>Roulette Mode</Text>
              <Text style={styles.rouletteDesc}>
                Randomize shares via Chainlink VRF — someone might pay $0!
              </Text>
            </View>
          </View>
          <Switch
            value={roulette}
            onValueChange={setRoulette}
            trackColor={{ false: '#e0e0e0', true: '#d63031' }}
            thumbColor="#fff"
          />
        </View>
      )}

      {/* Unlink Privacy Toggle */}
      {selectedGroup && (
        <View style={styles.privacyRow}>
          <View style={styles.privacyInfo}>
            <FontAwesome name="eye-slash" size={18} color="#6C5CE7" />
            <View style={styles.privacyText}>
              <Text style={styles.privacyLabel}>Private Payment</Text>
              <Text style={styles.privacyDesc}>
                Shield sender & amount via Unlink ZK proofs
              </Text>
            </View>
          </View>
          <Switch
            value={privacy}
            onValueChange={setPrivacy}
            trackColor={{ false: '#e0e0e0', true: '#6C5CE7' }}
            thumbColor="#fff"
          />
        </View>
      )}

      {/* Share Breakdown */}
      {selectedGroup && (
        <>
          <Text style={styles.sectionTitle}>
            {roulette ? 'Shares (randomized on-chain)' : 'Per-person share'}
          </Text>
          <View style={styles.shareCard}>
            {roulette ? (
              <View style={styles.roulettePreview}>
                <FontAwesome name="question-circle" size={32} color="#d63031" />
                <Text style={styles.roulettePreviewText}>
                  Shares will be randomly assigned by Chainlink VRF after session creation.
                  One person could pay the entire bill!
                </Text>
              </View>
            ) : (
              selectedGroup.members.map((member) => (
                <View key={member.address} style={styles.shareRow}>
                  <Text style={styles.shareName}>
                    {member.displayName || `${member.address.slice(0, 6)}...${member.address.slice(-4)}`}
                  </Text>
                  <Text style={styles.shareAmount}>
                    ${(sharePerMember / 1e6).toFixed(2)}
                  </Text>
                </View>
              ))
            )}
            <View style={styles.divider} />
            <View style={styles.shareRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalAmount}>${amountUsdc}</Text>
            </View>
          </View>
        </>
      )}

      {/* Action Buttons */}
      {isWcPay ? (
        <TouchableOpacity
          style={[styles.wcPayBtn, !selectedGroup && styles.createBtnDisabled]}
          onPress={handlePayAndSplit}
          disabled={!selectedGroup}
        >
          <FontAwesome name="wifi" size={16} color="#fff" />
          <Text style={styles.createBtnText}>Pay & Split via WalletConnect</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.createBtn, !selectedGroup && styles.createBtnDisabled]}
          onPress={handleCreateSplit}
          disabled={!selectedGroup}
        >
          <Text style={styles.createBtnText}>Create Split Session</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  summaryCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#6C5CE711',
    alignItems: 'center',
    marginBottom: 24,
  },
  merchantNameText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  wcBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#6C5CE722',
  },
  wcBadgeText: {
    fontSize: 11,
    color: '#6C5CE7',
    fontWeight: '600',
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
  merchantAddr: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
    fontFamily: 'SpaceMono',
  },
  chainBadge: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#6C5CE722',
  },
  chainBadgeText: {
    fontSize: 11,
    color: '#6C5CE7',
    fontWeight: '600',
  },
  merchantInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 14,
    fontSize: 14,
    fontFamily: 'SpaceMono',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 8,
  },
  emptyGroups: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  emptyText: {
    color: '#999',
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 8,
  },
  groupRowSelected: {
    borderColor: '#6C5CE7',
    backgroundColor: '#6C5CE711',
  },
  groupInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  groupName: {
    fontSize: 15,
  },
  groupNameSelected: {
    fontWeight: '600',
    color: '#6C5CE7',
  },
  groupMembers: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  shareCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 16,
    marginBottom: 24,
    backgroundColor: 'transparent',
  },
  shareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  shareName: {
    fontSize: 14,
    color: '#666',
  },
  shareAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e0e0e0',
    marginVertical: 4,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  totalAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6C5CE7',
  },
  rouletteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 16,
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
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginTop: 8,
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
    fontWeight: '600',
    color: '#6C5CE7',
  },
  privacyDesc: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  roulettePreview: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
    backgroundColor: 'transparent',
  },
  roulettePreviewText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  createBtn: {
    backgroundColor: '#6C5CE7',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  wcPayBtn: {
    backgroundColor: '#6C5CE7',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  createBtnDisabled: {
    opacity: 0.5,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
