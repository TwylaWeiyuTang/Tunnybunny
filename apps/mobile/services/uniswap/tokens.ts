export interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  icon: string; // FontAwesome icon name
  addresses: Record<number, string>; // chainId -> address
}

/**
 * Supported tokens for payment.
 * Address 0xEeee... represents native ETH.
 */
export const PAYMENT_TOKENS: TokenInfo[] = [
  {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    icon: 'dollar',
    addresses: {
      11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      84532: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      421614: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
      80002: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
    },
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    icon: 'diamond',
    addresses: {
      11155111: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      84532: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      421614: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    },
  },
  {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    icon: 'diamond',
    addresses: {
      11155111: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
      84532: '0x4200000000000000000000000000000000000006',
      421614: '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73',
    },
  },
  {
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    icon: 'circle-o',
    addresses: {
      11155111: '0x68194a729C2450ad26072b3D33ADaCbcef39D574',
      84532: '0x7683022d84F726a96c4A6611cD31DBf5409c0Ac9',
    },
  },
  {
    symbol: 'LINK',
    name: 'Chainlink',
    decimals: 18,
    icon: 'chain',
    addresses: {
      11155111: '0x779877A7B0D9E8603169DdbD7836e478b4624789',
      84532: '0xE4aB69C077896252FAFBD49EFD26B5D171A32410',
    },
  },
];

/**
 * Get the USDC address for a given chain
 */
export function getUsdcAddress(chainId: number): string | undefined {
  return PAYMENT_TOKENS.find((t) => t.symbol === 'USDC')?.addresses[chainId];
}

/**
 * Get token address for a symbol on a chain
 */
export function getTokenAddress(symbol: string, chainId: number): string | undefined {
  return PAYMENT_TOKENS.find((t) => t.symbol === symbol)?.addresses[chainId];
}

/**
 * Format a token amount from its smallest unit to human-readable
 */
export function formatTokenAmount(amount: string, decimals: number): string {
  const num = BigInt(amount);
  const divisor = BigInt(10 ** decimals);
  const whole = num / divisor;
  const fraction = num % divisor;
  const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, 6);
  // Remove trailing zeros
  const trimmed = fractionStr.replace(/0+$/, '') || '0';
  if (trimmed === '0') return whole.toString();
  return `${whole}.${trimmed}`;
}

/**
 * Convert a human-readable amount to smallest unit
 */
export function parseTokenAmount(amount: string, decimals: number): string {
  const [whole = '0', frac = ''] = amount.split('.');
  const paddedFrac = frac.padEnd(decimals, '0').slice(0, decimals);
  return (BigInt(whole) * BigInt(10 ** decimals) + BigInt(paddedFrac)).toString();
}
