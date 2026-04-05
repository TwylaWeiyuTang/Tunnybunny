import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Share, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import QRCode from 'react-native-qrcode-svg';

import { Linking } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useSplitPayment } from '@/hooks/useSplitPayment';
import { useWalletStore } from '@/store/wallet';
import { SPLITTER_ADDRESS, ROULETTE_ADDRESS } from '@/constants/contracts';

export default function SplitStatusScreen() {
  const params = useLocalSearchParams<{
    joinSessionId?: string;
    joinMerchant?: string;
    joinTotal?: string;
    joinGroupName?: string;
    joinParticipants?: string;
  }>();

  const {
    merchantAddress,
    totalAmountRaw,
    groupName,
    participants,
    contractSessionId,
    status,
    roulette,
    setSession,
    setContractSessionId,
    setStatus,
    createOnChainSession,
    pollForShares,
    depositMyShare,
    refreshStatus,
    reset,
  } = useSplitPayment();

  const { address } = useWalletStore();
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const [sourceChain, setSourceChain] = useState(42161); // default Arbitrum

  const PAY_CHAINS = [
    { id: 42161, name: 'Arbitrum', icon: 'bolt' as const },
    { id: 8453, name: 'Base', icon: 'circle' as const },
    { id: 1, name: 'Ethereum', icon: 'diamond' as const },
  ];

  // If joining an existing session (scanned QR from another member),
  // populate the store and skip session creation.
  useEffect(() => {
    if (params.joinSessionId && contractSessionId === null) {
      let parsedParticipants: any[] = [];
      try {
        parsedParticipants = JSON.parse(params.joinParticipants || '[]');
      } catch {}

      setSession({
        merchantAddress: params.joinMerchant || '',
        totalAmountRaw: params.joinTotal || '0',
        groupName: params.joinGroupName || '',
        participants: parsedParticipants,
        roulette: false,
      });
      setContractSessionId(parseInt(params.joinSessionId, 10));
      setStatus('collecting');
    }
  }, [params.joinSessionId]);

  const totalUsdc = (parseInt(totalAmountRaw || '0') / 1e6).toFixed(2);
  const depositedCount = participants.filter((p) => p.status === 'deposited').length;
  const myParticipant = participants.find(
    (p) => p.address.toLowerCase() === address?.toLowerCase(),
  );
  const isPayer = address?.toLowerCase() === merchantAddress?.toLowerCase();
  const canDeposit = myParticipant && myParticipant.status === 'pending' && status === 'collecting' && !isPayer;

  // Auto-create on-chain session when screen mounts (only for session creator)
  useEffect(() => {
    if (status === 'creating' && contractSessionId === null && !params.joinSessionId) {
      createOnChainSession().catch((err) => {
        console.warn('createOnChainSession error (tx may have succeeded):', err.message);
      });
    }
  }, [status, contractSessionId]);

  // Roulette: poll for VRF fulfillment
  useEffect(() => {
    if (status === 'waiting-vrf' && roulette) {
      pollRef.current = setInterval(() => {
        pollForShares().catch(() => {});
      }, 3000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [status, roulette]);

  // Poll for deposit status updates every 5 seconds
  useEffect(() => {
    if (status === 'collecting') {
      const interval = setInterval(() => {
        refreshStatus().catch(() => {});
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [status]);

  // QR payload for other members to join this split session
  const sharePayload = contractSessionId !== null
    ? JSON.stringify({
        app: 'tunnybunny-split',
        contractSessionId,
        merchantAddress,
        totalAmountRaw,
        groupName,
        participants,
      })
    : '';

  // Settled state
  if (status === 'settled') {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <FontAwesome name="check-circle" size={64} color="#00b894" />
          <Text style={styles.successText}>Bill Settled!</Text>
          <Text style={styles.successDetail}>
            ${totalUsdc} sent to merchant
          </Text>
          <Text style={styles.successSub}>
            {merchantAddress?.slice(0, 6)}...{merchantAddress?.slice(-4)}
          </Text>
          <View style={styles.splitBadge}>
            <FontAwesome name={roulette ? 'random' : 'users'} size={12} color={roulette ? '#d63031' : '#6C5CE7'} />
            <Text style={[styles.splitBadgeText, roulette && { color: '#d63031' }]}>
              {roulette
                ? `Roulette split ${participants.length} ways via Chainlink VRF`
                : `Split ${participants.length} ways via BillSplitter contract`}
            </Text>
          </View>

          {/* On-chain proof links */}
          <View style={styles.proofSection}>
            <Text style={styles.proofTitle}>On-chain Proof</Text>
            {participants.filter((p) => p.txHash).map((p) => (
              <TouchableOpacity
                key={p.address}
                style={styles.proofRow}
                onPress={() => Linking.openURL(`https://arbiscan.io/tx/${p.txHash}`)}
              >
                <Text style={styles.proofLabel}>
                  {p.address.slice(0, 6)}...{p.address.slice(-4)}
                </Text>
                <Text style={styles.proofLink}>
                  {p.txHash?.slice(0, 8)}... ↗
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.proofRow}
              onPress={() =>
                Linking.openURL(
                  `https://arbiscan.io/address/${roulette ? ROULETTE_ADDRESS : SPLITTER_ADDRESS}#tokentxns`
                )
              }
            >
              <Text style={styles.proofLabel}>Contract USDC transfers</Text>
              <Text style={styles.proofLink}>View on Arbiscan ↗</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.proofRow}
              onPress={() =>
                Linking.openURL(
                  `https://arbiscan.io/address/${merchantAddress}#tokentxns`
                )
              }
            >
              <Text style={styles.proofLabel}>Merchant received</Text>
              <Text style={styles.proofLink}>View on Arbiscan ↗</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => {
              reset();
              router.dismissAll();
            }}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerCard}>
        <Text style={styles.headerLabel}>{groupName}</Text>
        <Text style={styles.headerAmount}>${totalUsdc}</Text>
        <Text style={styles.headerMerchant}>
          {isPayer ? 'You paid — waiting for reimbursement' : `To: ${merchantAddress?.slice(0, 6)}...${merchantAddress?.slice(-4)}`}
        </Text>
        {contractSessionId !== null && (
          <Text style={styles.sessionId}>Session #{contractSessionId}</Text>
        )}
      </View>

      {/* Progress */}
      <View style={styles.progressRow}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(depositedCount / participants.length) * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {depositedCount}/{participants.length} paid
        </Text>
      </View>

      {/* Participants */}
      <Text style={styles.sectionTitle}>Participants</Text>
      {participants.map((p) => {
        const isMe = p.address.toLowerCase() === address?.toLowerCase();
        return (
          <View key={p.address} style={styles.participantRow}>
            <View style={styles.participantInfo}>
              <Text style={styles.participantName}>
                {isMe ? 'You' : p.displayName || `${p.address.slice(0, 6)}...${p.address.slice(-4)}`}
              </Text>
              <Text style={[
                styles.participantShare,
                roulette && p.shareAmount === 0 && status === 'collecting' && styles.luckyShare,
              ]}>
                {roulette && status === 'waiting-vrf'
                  ? '???'
                  : roulette && p.shareAmount === 0
                    ? 'FREE!'
                    : `$${(p.shareAmount / 1e6).toFixed(2)}`}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                p.status === 'deposited' && styles.statusDeposited,
                p.status === 'approved' && styles.statusApproved,
              ]}
            >
              {p.status === 'deposited' ? (
                <FontAwesome name="check" size={12} color="#00b894" />
              ) : p.status === 'approved' ? (
                <ActivityIndicator size="small" color="#6C5CE7" />
              ) : (
                <FontAwesome name="clock-o" size={12} color="#999" />
              )}
              <Text
                style={[
                  styles.statusText,
                  p.status === 'deposited' && styles.statusTextDeposited,
                  p.status === 'approved' && styles.statusTextApproved,
                ]}
              >
                {p.status === 'deposited' ? 'Paid' : p.status === 'approved' ? 'Approving...' : 'Pending'}
              </Text>
            </View>
          </View>
        );
      })}

      {/* Chain selector + Pay My Share */}
      {canDeposit && (
        <>
          <Text style={styles.sectionTitle}>Pay from</Text>
          <View style={styles.chainSelector}>
            {PAY_CHAINS.map((chain) => (
              <TouchableOpacity
                key={chain.id}
                style={[
                  styles.chainChip,
                  sourceChain === chain.id && styles.chainChipSelected,
                ]}
                onPress={() => setSourceChain(chain.id)}
              >
                <FontAwesome
                  name={chain.icon}
                  size={12}
                  color={sourceChain === chain.id ? '#6C5CE7' : '#999'}
                />
                <Text
                  style={[
                    styles.chainChipText,
                    sourceChain === chain.id && styles.chainChipTextSelected,
                  ]}
                >
                  {chain.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {sourceChain !== 42161 && (
            <View style={styles.bridgeNote}>
              <FontAwesome name="exclamation-triangle" size={14} color="#f0932b" />
              <Text style={styles.bridgeNoteText}>
                Switch MetaMask to <Text style={{ fontWeight: '700' }}>{PAY_CHAINS.find((c) => c.id === sourceChain)?.name}</Text> before paying.{'\n'}
                USDC will be bridged to Arbitrum via Arc (Circle CCTP).
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.payBtn}
            onPress={() => {
              if (sourceChain !== 42161) {
                Alert.alert(
                  'Switch Chain First',
                  `Open MetaMask and switch to ${PAY_CHAINS.find((c) => c.id === sourceChain)?.name} before continuing.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: "I've Switched", onPress: () => depositMyShare(sourceChain).catch(() => {}) },
                  ],
                );
              } else {
                depositMyShare(sourceChain).catch(() => {});
              }
            }}
          >
            <Text style={styles.payBtnText}>
              Pay My Share (${(myParticipant.shareAmount / 1e6).toFixed(2)})
            </Text>
          </TouchableOpacity>
        </>
      )}

      {myParticipant?.status === 'approved' && (
        <View style={styles.processingRow}>
          <ActivityIndicator color="#6C5CE7" />
          <Text style={styles.processingText}>
            {sourceChain !== 42161
              ? 'Bridging USDC via Arc, then depositing...'
              : 'Processing your payment...'}
          </Text>
        </View>
      )}

      {/* Share QR for other members */}
      {status === 'collecting' && contractSessionId !== null && (
        <>
          <Text style={styles.sectionTitle}>Share with group</Text>
          <View style={styles.qrCard}>
            <View style={styles.qrContainer}>
              <QRCode value={sharePayload} size={180} backgroundColor="white" color="#1a1a2e" />
            </View>
            <Text style={styles.qrHint}>
              Other members scan this to deposit their share
            </Text>
            <TouchableOpacity
              style={styles.shareTextBtn}
              onPress={() =>
                Share.share({
                  message: `Pay your share for "${groupName}"!\n\n${sharePayload}`,
                })
              }
            >
              <FontAwesome name="share" size={14} color="#6C5CE7" />
              <Text style={styles.shareTextBtnText}>Share via Message</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Creating state */}
      {status === 'creating' && (
        <View style={styles.processingRow}>
          <ActivityIndicator color="#6C5CE7" />
          <Text style={styles.processingText}>Creating on-chain session...</Text>
        </View>
      )}

      {/* Waiting for Chainlink VRF */}
      {status === 'waiting-vrf' && (
        <View style={styles.vrfCard}>
          <FontAwesome name="random" size={32} color="#d63031" />
          <Text style={styles.vrfTitle}>Roulette Mode</Text>
          <ActivityIndicator color="#d63031" style={{ marginTop: 12 }} />
          <Text style={styles.vrfText}>
            Waiting for Chainlink VRF to assign random shares...
          </Text>
          <Text style={styles.vrfSubtext}>
            This can take 30s-2min on testnet, ~10s on mainnet
          </Text>
        </View>
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
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: 'transparent',
  },
  headerCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#6C5CE711',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLabel: {
    fontSize: 13,
    color: '#999',
  },
  headerAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: '#6C5CE7',
    marginTop: 4,
  },
  headerMerchant: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
    fontFamily: 'SpaceMono',
  },
  sessionId: {
    fontSize: 11,
    color: '#6C5CE7',
    fontFamily: 'SpaceMono',
    marginTop: 4,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  progressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e0e0e0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#00b894',
  },
  progressText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 8,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    backgroundColor: 'transparent',
  },
  participantInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  participantName: {
    fontSize: 15,
    fontWeight: '500',
  },
  participantShare: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  statusDeposited: {
    backgroundColor: '#00b89422',
  },
  statusApproved: {
    backgroundColor: '#6C5CE722',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
  },
  statusTextDeposited: {
    color: '#00b894',
  },
  statusTextApproved: {
    color: '#6C5CE7',
  },
  chainSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  chainChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: 'transparent',
  },
  chainChipSelected: {
    borderColor: '#6C5CE7',
    backgroundColor: '#6C5CE711',
  },
  chainChipText: {
    fontSize: 13,
    color: '#999',
  },
  chainChipTextSelected: {
    color: '#6C5CE7',
    fontWeight: '600',
  },
  bridgeNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#6C5CE708',
    marginBottom: 12,
  },
  bridgeNoteText: {
    fontSize: 12,
    color: '#6C5CE7',
    flex: 1,
  },
  payBtn: {
    backgroundColor: '#6C5CE7',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  payBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
    backgroundColor: 'transparent',
  },
  processingText: {
    fontSize: 14,
    color: '#6C5CE7',
    fontWeight: '500',
  },
  qrCard: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  qrContainer: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'white',
    marginBottom: 12,
  },
  qrHint: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
  },
  shareTextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6C5CE7',
  },
  shareTextBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6C5CE7',
  },
  luckyShare: {
    color: '#00b894',
    fontWeight: '700',
  },
  vrfCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d6303133',
    backgroundColor: '#d6303108',
    marginTop: 16,
  },
  vrfTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#d63031',
    marginTop: 8,
  },
  vrfText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  vrfSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  proofSection: {
    width: '100%',
    marginTop: 20,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  proofTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 8,
    textAlign: 'center',
  },
  proofRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    backgroundColor: 'transparent',
  },
  proofLabel: {
    fontSize: 13,
    color: '#666',
  },
  proofLink: {
    fontSize: 13,
    color: '#6C5CE7',
    fontWeight: '600',
    fontFamily: 'SpaceMono',
  },
  // Success
  successText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#00b894',
    marginTop: 16,
  },
  successDetail: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  successSub: {
    fontSize: 13,
    color: '#999',
    fontFamily: 'SpaceMono',
    marginTop: 4,
  },
  splitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#6C5CE711',
    marginTop: 16,
  },
  splitBadgeText: {
    fontSize: 12,
    color: '#6C5CE7',
    fontWeight: '600',
  },
  doneBtn: {
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 32,
  },
  doneBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
