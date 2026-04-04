import { StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { Text, View } from '@/components/Themed';
import { useSettlementStore } from '@/store/settlement';
import { useWalletStore } from '@/store/wallet';
import { useUniswapQuote } from '@/hooks/useUniswapQuote';
import { PAYMENT_TOKENS, type TokenInfo } from '@/services/uniswap/tokens';

export default function TokenSelectScreen() {
  const { amount, sourceChain } = useSettlementStore();
  const amountUsd = (amount / 100).toFixed(2);

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>
        Select token to pay ${amountUsd}
      </Text>
      <Text style={styles.hint}>
        Non-USDC tokens will be swapped via Uniswap API
      </Text>

      <FlatList
        data={PAYMENT_TOKENS.filter((t) => t.addresses[sourceChain])}
        keyExtractor={(item) => item.symbol}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TokenRow token={item} amountCents={amount} chainId={sourceChain} />
        )}
      />

      <View style={styles.poweredBy}>
        <Text style={styles.poweredByText}>Powered by Uniswap API</Text>
      </View>
    </View>
  );
}

function TokenRow({ token, amountCents, chainId }: { token: TokenInfo; amountCents: number; chainId: number }) {
  const { address } = useWalletStore();
  const { setSettlement } = useSettlementStore();
  const isUsdc = token.symbol === 'USDC';

  const { tokenAmount, gasFeeUsd, isLoading, error } = useUniswapQuote({
    token,
    usdAmount: amountCents,
    chainId,
    swapperAddress: address || undefined,
    enabled: !isUsdc,
  });

  const selectToken = () => {
    setSettlement({
      tokenSymbol: token.symbol,
      tokenIn: token.addresses[chainId] || '',
    });
    router.back();
  };

  return (
    <TouchableOpacity style={styles.tokenRow} onPress={selectToken}>
      <View style={styles.tokenIcon}>
        <FontAwesome name={token.icon as any} size={20} color="#6C5CE7" />
      </View>
      <View style={styles.tokenInfo}>
        <Text style={styles.tokenSymbol}>{token.symbol}</Text>
        <Text style={styles.tokenName}>{token.name}</Text>
      </View>
      <View style={styles.tokenQuote}>
        {isUsdc ? (
          <>
            <Text style={styles.quoteAmount}>{tokenAmount}</Text>
            <Text style={styles.quoteLabel}>No swap needed</Text>
          </>
        ) : isLoading ? (
          <ActivityIndicator size="small" color="#6C5CE7" />
        ) : error ? (
          <>
            <Text style={styles.quoteAmount}>--</Text>
            <Text style={styles.quoteLabelError}>Quote unavailable</Text>
          </>
        ) : (
          <>
            <Text style={styles.quoteAmount}>{tokenAmount}</Text>
            <View style={styles.quoteDetails}>
              <Text style={styles.quoteLabel}>via Uniswap</Text>
              {gasFeeUsd !== '0' && gasFeeUsd !== '...' && (
                <Text style={styles.gasFee}>Gas: ~${gasFeeUsd}</Text>
              )}
            </View>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  hint: {
    fontSize: 13,
    color: '#999',
    marginBottom: 20,
  },
  list: {
    gap: 8,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    gap: 12,
  },
  tokenIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6C5CE711',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  tokenSymbol: {
    fontSize: 16,
    fontWeight: '600',
  },
  tokenName: {
    fontSize: 13,
    color: '#999',
  },
  tokenQuote: {
    alignItems: 'flex-end',
    backgroundColor: 'transparent',
    minWidth: 80,
  },
  quoteAmount: {
    fontSize: 15,
    fontWeight: '600',
  },
  quoteDetails: {
    alignItems: 'flex-end',
    backgroundColor: 'transparent',
  },
  quoteLabel: {
    fontSize: 11,
    color: '#6C5CE7',
  },
  quoteLabelError: {
    fontSize: 11,
    color: '#d63031',
  },
  gasFee: {
    fontSize: 10,
    color: '#999',
    marginTop: 1,
  },
  poweredBy: {
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  poweredByText: {
    fontSize: 11,
    color: '#999',
  },
});
