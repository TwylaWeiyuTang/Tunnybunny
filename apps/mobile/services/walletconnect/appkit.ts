import '@walletconnect/react-native-compat';

import { createAppKit, type Storage } from '@reown/appkit-react-native';
import { EthersAdapter } from '@reown/appkit-ethers-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const appKitStorage: Storage = {
  async getKeys() {
    return AsyncStorage.getAllKeys() as Promise<string[]>;
  },
  async getEntries<T = any>() {
    const keys = await AsyncStorage.getAllKeys();
    const pairs = await AsyncStorage.multiGet(keys as string[]);
    return pairs.map(([k, v]) => [k, v ? JSON.parse(v) : undefined] as [string, T]);
  },
  async getItem<T = any>(key: string) {
    const value = await AsyncStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : undefined;
  },
  async setItem<T = any>(key: string, value: T) {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
  },
};

// Define networks in viem-compatible format (rpcUrls.default.http)
const baseSepolia = {
  id: 84532,
  name: 'Base Sepolia',
  chainNamespace: 'eip155' as const,
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://sepolia.base.org'] },
  },
  blockExplorers: {
    default: { name: 'BaseScan', url: 'https://sepolia.basescan.org' },
  },
  testnet: true,
};

const ethereumSepolia = {
  id: 11155111,
  name: 'Ethereum Sepolia',
  chainNamespace: 'eip155' as const,
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.sepolia.org'] },
  },
  blockExplorers: {
    default: { name: 'Etherscan', url: 'https://sepolia.etherscan.io' },
  },
  testnet: true,
};

const arbitrumSepolia = {
  id: 421614,
  name: 'Arbitrum Sepolia',
  chainNamespace: 'eip155' as const,
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://sepolia-rollup.arbitrum.io/rpc'] },
  },
  blockExplorers: {
    default: { name: 'Arbiscan', url: 'https://sepolia.arbiscan.io' },
  },
  testnet: true,
};

const polygonAmoy = {
  id: 80002,
  name: 'Polygon Amoy',
  chainNamespace: 'eip155' as const,
  nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc-amoy.polygon.technology'] },
  },
  blockExplorers: {
    default: { name: 'PolygonScan', url: 'https://amoy.polygonscan.com' },
  },
  testnet: true,
};

const base = {
  id: 8453,
  name: 'Base',
  chainNamespace: 'eip155' as const,
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mainnet.base.org'] },
  },
  blockExplorers: {
    default: { name: 'BaseScan', url: 'https://basescan.org' },
  },
  testnet: false,
};

// Ethereum mainnet is required so MetaMask (which defaults to mainnet)
// can match accounts during WalletConnect session establishment.
const ethereum = {
  id: 1,
  name: 'Ethereum',
  chainNamespace: 'eip155' as const,
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://ethereum-rpc.publicnode.com'] },
  },
  blockExplorers: {
    default: { name: 'Etherscan', url: 'https://etherscan.io' },
  },
  testnet: false,
};

const arbitrum = {
  id: 42161,
  name: 'Arbitrum One',
  chainNamespace: 'eip155' as const,
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://arbitrum-one-rpc.publicnode.com'] },
  },
  blockExplorers: {
    default: { name: 'Arbiscan', url: 'https://arbiscan.io' },
  },
  testnet: false,
};

export const networks = [arbitrum, base, ethereum, baseSepolia, ethereumSepolia, arbitrumSepolia, polygonAmoy] as const;

// TODO: Replace with your Reown project ID from https://dashboard.reown.com/
const projectId = process.env.EXPO_PUBLIC_REOWN_PROJECT_ID || 'YOUR_PROJECT_ID';

export const metadata = {
  name: 'TunnyBunny',
  description: 'Split bills with friends across any chain',
  url: 'https://tunnybunny.app',
  icons: ['https://tunnybunny.app/icon.png'],
};

let appKitInstance: ReturnType<typeof createAppKit> | null = null;

/**
 * Lazily initialize AppKit to avoid crashes during static web export
 * (AsyncStorage is not available in Node.js / static rendering)
 */
export function getAppKit() {
  if (!appKitInstance && Platform.OS !== 'web') {
    const ethersAdapter = new EthersAdapter();
    appKitInstance = createAppKit({
      projectId,
      metadata,
      networks,
      defaultNetwork: arbitrum,
      adapters: [ethersAdapter],
      storage: appKitStorage,
      features: {
        email: true,
        socials: ['google', 'apple', 'x', 'github', 'discord'],
        swaps: true,
        onramp: true,
      },
    });
  }
  return appKitInstance;
}

export { projectId };
