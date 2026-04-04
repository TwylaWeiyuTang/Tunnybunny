import { StyleSheet, TouchableOpacity, Share } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import QRCode from 'react-native-qrcode-svg';

import { Text, View } from '@/components/Themed';
import { useWalletStore } from '@/store/wallet';

/**
 * Payee screen: displays a QR code encoding the payment request.
 * The payer scans this QR inside TunnyBunny to settle the debt.
 *
 * QR payload is a JSON string:
 * { "app": "tunnybunny", "to": "0x...", "amount": 1050, "chain": 84532, "groupId": "..." }
 */
export default function RequestPaymentScreen() {
  const { amount, groupId } = useLocalSearchParams<{
    amount: string;
    groupId: string;
  }>();

  const { address } = useWalletStore();
  const amountCents = parseInt(amount || '0', 10);
  const amountUsd = (amountCents / 100).toFixed(2);

  const payload = JSON.stringify({
    app: 'tunnybunny',
    to: address,
    amount: amountCents,
    chain: 84532, // Base Sepolia (default settlement chain)
    groupId: groupId || null,
  });

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Payment Request</Text>
        <Text style={styles.amountLabel}>Amount due</Text>
        <Text style={styles.amount}>${amountUsd}</Text>

        <View style={styles.qrContainer}>
          <QRCode
            value={payload}
            size={220}
            backgroundColor="white"
            color="#1a1a2e"
          />
        </View>

        <Text style={styles.hint}>
          Ask the payer to scan this QR code{'\n'}inside TunnyBunny to settle up
        </Text>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>To</Text>
          <Text style={styles.detailValue}>
            {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Chain</Text>
          <Text style={styles.detailValue}>Base Sepolia</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Token</Text>
          <Text style={styles.detailValue}>USDC</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.shareBtn}
        onPress={() =>
          Share.share({
            message: `Pay me $${amountUsd} on TunnyBunny!\n\n${payload}`,
          })
        }
      >
        <FontAwesome name="share" size={16} color="#6C5CE7" />
        <Text style={styles.shareBtnText}>Share Request</Text>
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
  amountLabel: {
    fontSize: 13,
    color: '#999',
  },
  amount: {
    fontSize: 40,
    fontWeight: '800',
    color: '#6C5CE7',
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
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 6,
    backgroundColor: 'transparent',
  },
  detailLabel: {
    fontSize: 13,
    color: '#999',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'SpaceMono',
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
