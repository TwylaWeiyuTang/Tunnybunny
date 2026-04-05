// Arbitrum One mainnet (primary for POS split demo)
export const USDC_ARB = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
export const ARB_CHAIN_ID = 42161;

// Base Sepolia (for testing)
export const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
export const BASE_SEPOLIA_CHAIN_ID = 84532;

// Set these after deploying to Base mainnet
export const SPLITTER_ADDRESS =
  process.env.EXPO_PUBLIC_SPLITTER_ADDRESS || '0x0000000000000000000000000000000000000000';
export const ROULETTE_ADDRESS =
  process.env.EXPO_PUBLIC_ROULETTE_ADDRESS || '0x0000000000000000000000000000000000000000';

export const SPLITTER_ABI = [
  'function createSession(address merchant, uint256 totalAmount) returns (uint256)',
  'function deposit(uint256 sessionId, uint256 amount)',
  'function sessions(uint256) view returns (address merchant, uint256 totalAmount, uint256 collected, bool settled)',
  'function deposits(uint256, address) view returns (uint256)',
  'event SessionCreated(uint256 indexed id, address merchant, uint256 totalAmount)',
  'event Deposited(uint256 indexed id, address indexed payer, uint256 amount)',
  'event Settled(uint256 indexed id, address merchant, uint256 totalAmount)',
] as const;

export const ROULETTE_ABI = [
  'function createSession(address merchant, uint256 totalAmount, address[] participants) returns (uint256)',
  'function deposit(uint256 sessionId)',
  'function sessions(uint256) view returns (address merchant, uint256 totalAmount, uint256 collected, bool settled, bool sharesAssigned)',
  'function getShare(uint256 sessionId, address participant) view returns (uint256)',
  'function areSharesAssigned(uint256 sessionId) view returns (bool)',
  'function getParticipants(uint256 sessionId) view returns (address[])',
  'function deposits(uint256, address) view returns (uint256)',
  'event SessionCreated(uint256 indexed id, address merchant, uint256 totalAmount)',
  'event SharesAssigned(uint256 indexed id)',
  'event ShareRevealed(uint256 indexed id, address indexed participant, uint256 amount)',
  'event Deposited(uint256 indexed id, address indexed payer, uint256 amount)',
  'event Settled(uint256 indexed id, address merchant, uint256 totalAmount)',
] as const;
