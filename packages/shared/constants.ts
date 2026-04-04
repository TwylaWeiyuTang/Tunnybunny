import type { SupportedChain } from './types';

export const SUPPORTED_CHAINS: Record<number, SupportedChain> = {
  // Ethereum Sepolia
  11155111: {
    id: 11155111,
    name: 'Ethereum Sepolia',
    rpcUrl: 'https://rpc.sepolia.org',
    usdcAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  },
  // Base Sepolia
  84532: {
    id: 84532,
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  },
  // Arbitrum Sepolia
  421614: {
    id: 421614,
    name: 'Arbitrum Sepolia',
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    usdcAddress: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
  },
  // Polygon Amoy
  80002: {
    id: 80002,
    name: 'Polygon Amoy',
    rpcUrl: 'https://rpc-amoy.polygon.technology',
    usdcAddress: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
  },
};

// Primary settlement chain
export const DEFAULT_SETTLEMENT_CHAIN = 84532; // Base Sepolia

// Common token addresses (Sepolia)
export const TOKENS: Record<string, { symbol: string; decimals: number; addresses: Record<number, string> }> = {
  USDC: {
    symbol: 'USDC',
    decimals: 6,
    addresses: {
      11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      84532: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      421614: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
      80002: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
    },
  },
  ETH: {
    symbol: 'ETH',
    decimals: 18,
    addresses: {
      11155111: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      84532: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      421614: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    },
  },
  WETH: {
    symbol: 'WETH',
    decimals: 18,
    addresses: {
      11155111: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
      84532: '0x4200000000000000000000000000000000000006',
      421614: '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73',
    },
  },
};

export const BACKEND_URL = __DEV__
  ? 'http://localhost:3001'
  : 'https://tunnybunny-api.railway.app'; // Update after deploy
