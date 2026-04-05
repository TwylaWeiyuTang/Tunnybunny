import { useState } from 'react';
import { StyleSheet, TouchableOpacity, Platform, ScrollView } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { Text, View } from '@/components/Themed';
import { useWalletStore } from '@/store/wallet';

const SETTLEMENT_CHAINS = [
  { id: 42161, name: 'Arbitrum One' },
  { id: 8453, name: 'Base' },
  { id: 1, name: 'Ethereum' },
  { id: 84532, name: 'Base Sepolia' },
  { id: 11155111, name: 'Ethereum Sepolia' },
];

// AppKit hooks only work on native (not during static web export)
let useAppKit: () => { open: (opts?: { view?: string }) => void; disconnect: () => void };
let useAppKitAccount: () => { address?: string; isConnected: boolean; chainId?: string };

if (Platform.OS !== 'web') {
  const appkitModule = require('@reown/appkit-react-native');
  useAppKit = appkitModule.useAppKit;
  useAppKitAccount = appkitModule.useAccount;
} else {
  useAppKit = () => ({ open: () => {}, disconnect: () => {} });
  useAppKitAccount = () => ({ address: undefined, isConnected: false, chainId: undefined });
}

export default function ProfileScreen() {
  const { open, disconnect } = useAppKit();
  const appKitAccount = useAppKitAccount();
  const walletStore = useWalletStore();
  const [settlementChain, setSettlementChain] = useState(42161);
  const [showChainPicker, setShowChainPicker] = useState(false);

  // Use AppKit state on native, Zustand fallback on web
  const isConnected = Platform.OS !== 'web' ? appKitAccount.isConnected : walletStore.isConnected;
  const address = Platform.OS !== 'web' ? appKitAccount.address : walletStore.address;
  const chainId = Platform.OS !== 'web' ? appKitAccount.chainId : walletStore.chainId;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <FontAwesome name="user-circle" size={64} color="#6C5CE7" />
        </View>
        {isConnected ? (
          <>
            <Text style={styles.address}>
              {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Unknown'}
            </Text>
            <Text style={styles.chain}>Chain ID: {chainId}</Text>
            <TouchableOpacity
              style={styles.disconnectBtn}
              onPress={() => disconnect()}
            >
              <Text style={styles.disconnectText}>Disconnect</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.notConnected}>Wallet not connected</Text>
            <TouchableOpacity
              style={styles.connectBtn}
              onPress={() => open({ view: 'Connect' })}
            >
              <Text style={styles.connectBtnText}>Connect Wallet</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Wallet Actions</Text>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => open({ view: 'OnRamp' })}
        >
          <FontAwesome name="credit-card" size={18} color="#6C5CE7" />
          <Text style={styles.actionLabel}>Buy Crypto</Text>
          <Text style={styles.actionHint}>via WalletConnect Pay</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => open({ view: 'Swap' })}
        >
          <FontAwesome name="exchange" size={18} color="#6C5CE7" />
          <Text style={styles.actionLabel}>Swap Tokens</Text>
          <Text style={styles.actionHint}>via WalletConnect Pay</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => open({ view: 'Networks' })}
        >
          <FontAwesome name="globe" size={18} color="#6C5CE7" />
          <Text style={styles.actionLabel}>Switch Network</Text>
          <Text style={styles.actionHint}>{chainId ? `Current: ${chainId}` : 'Select chain'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => setShowChainPicker(!showChainPicker)}
        >
          <FontAwesome name="chain" size={18} color="#6C5CE7" />
          <Text style={styles.settingLabel}>Preferred Settlement Chain</Text>
          <View style={styles.settingValueRow}>
            <Text style={styles.settingValue}>
              {SETTLEMENT_CHAINS.find((c) => c.id === settlementChain)?.name}
            </Text>
            <FontAwesome
              name={showChainPicker ? 'chevron-up' : 'chevron-down'}
              size={12}
              color="#999"
            />
          </View>
        </TouchableOpacity>
        {showChainPicker && (
          <View style={styles.chainPicker}>
            {SETTLEMENT_CHAINS.map((chain) => (
              <TouchableOpacity
                key={chain.id}
                style={[
                  styles.chainOption,
                  settlementChain === chain.id && styles.chainOptionSelected,
                ]}
                onPress={() => {
                  setSettlementChain(chain.id);
                  setShowChainPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.chainOptionText,
                    settlementChain === chain.id && styles.chainOptionTextSelected,
                  ]}
                >
                  {chain.name}
                </Text>
                {settlementChain === chain.id && (
                  <FontAwesome name="check" size={14} color="#6C5CE7" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.settingRow}>
          <FontAwesome name="eye-slash" size={18} color="#6C5CE7" />
          <Text style={styles.settingLabel}>Default Privacy Mode</Text>
          <Text style={styles.settingValue}>Off</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingRow}>
          <FontAwesome name="dollar" size={18} color="#6C5CE7" />
          <Text style={styles.settingLabel}>Default Payment Token</Text>
          <Text style={styles.settingValue}>USDC</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Integrations</Text>
        <IntegrationRow name="WalletConnect Pay" active={isConnected} />
        <IntegrationRow name="Uniswap" active />
        <IntegrationRow name="Arc (Cross-Chain)" active />
        <IntegrationRow name="Unlink (Privacy)" active />
      </View>
    </ScrollView>
  );
}

function IntegrationRow({ name, active }: { name: string; active?: boolean }) {
  return (
    <View style={styles.integrationRow}>
      <Text style={styles.integrationName}>{name}</Text>
      <View style={[styles.badge, active ? styles.badgeActive : styles.badgeInactive]}>
        <Text style={[styles.badgeText, !active && styles.badgeTextInactive]}>
          {active ? 'Ready' : 'Not Connected'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  avatarContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: 'transparent',
  },
  avatar: {
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  address: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'SpaceMono',
  },
  chain: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  notConnected: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  connectBtn: {
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  connectBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  disconnectBtn: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d63031',
    marginTop: 12,
  },
  disconnectText: {
    color: '#d63031',
    fontSize: 14,
    fontWeight: '500',
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
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    gap: 12,
  },
  actionLabel: {
    flex: 1,
    fontSize: 15,
  },
  actionHint: {
    fontSize: 12,
    color: '#6C5CE7',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    gap: 12,
  },
  settingLabel: {
    flex: 1,
    fontSize: 15,
  },
  settingValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'transparent',
  },
  settingValue: {
    fontSize: 14,
    color: '#999',
  },
  chainPicker: {
    marginLeft: 30,
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  chainOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  chainOptionSelected: {
    backgroundColor: '#6C5CE711',
  },
  chainOptionText: {
    fontSize: 14,
    color: '#666',
  },
  chainOptionTextSelected: {
    color: '#6C5CE7',
    fontWeight: '600',
  },
  integrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    backgroundColor: 'transparent',
  },
  integrationName: {
    fontSize: 15,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeActive: {
    backgroundColor: '#00b89422',
  },
  badgeInactive: {
    backgroundColor: '#d6303122',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#00b894',
  },
  badgeTextInactive: {
    color: '#d63031',
  },
});
