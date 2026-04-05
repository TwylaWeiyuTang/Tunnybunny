import { useCallback } from 'react';
import { Contract, BrowserProvider, JsonRpcProvider } from 'ethers';
import { useProvider } from '@reown/appkit-react-native';
import { useSplitSessionStore } from '@/store/splitSession';
import { useWalletStore } from '@/store/wallet';
import {
  SPLITTER_ADDRESS,
  SPLITTER_ABI,
  ROULETTE_ADDRESS,
  ROULETTE_ABI,
  USDC_ARB,
} from '@/constants/contracts';
import { bridgeUSDC, type ArcChainId } from '@/services/arc/bridge';
import { getWcPayActions, confirmWcPayment } from '@/services/walletconnect/pos';

// Direct RPC provider for waiting on tx receipts (avoids WalletConnect timeouts)
const ARB_RPC = 'https://arbitrum-one-rpc.publicnode.com';

const ERC20_ABI = ['function approve(address spender, uint256 amount) returns (bool)'];

/**
 * Hook that orchestrates both BillSplitter and BillSplitterRoulette contracts.
 * Normal mode: equal splits, deposit with explicit amount.
 * Roulette mode: random splits via Chainlink VRF, deposit assigned share.
 */
export function useSplitPayment() {
  const { provider: walletProvider } = useProvider();
  const { address } = useWalletStore();
  const store = useSplitSessionStore();

  const getProvider = useCallback(() => {
    if (!walletProvider) throw new Error('Wallet not connected');
    return new BrowserProvider(walletProvider as any);
  }, [walletProvider]);

  const getContractInfo = useCallback(() => {
    if (store.roulette) {
      return { address: ROULETTE_ADDRESS, abi: ROULETTE_ABI };
    }
    return { address: SPLITTER_ADDRESS, abi: SPLITTER_ABI };
  }, [store.roulette]);

  // Step 1: Create the on-chain session
  const createOnChainSession = useCallback(async () => {
    const provider = getProvider();
    const signer = await provider.getSigner();
    const { address: contractAddr, abi } = getContractInfo();
    const contract = new Contract(contractAddr, abi, signer);

    let tx;
    if (store.roulette) {
      // Roulette: pass participants for VRF-based random assignment
      const participantAddresses = store.participants.map((p) => p.address);
      tx = await contract.createSession(
        store.merchantAddress,
        store.totalAmountRaw,
        participantAddresses,
      );
    } else {
      tx = await contract.createSession(
        store.merchantAddress,
        store.totalAmountRaw,
      );
    }

    // Wait for receipt via direct RPC to avoid WalletConnect timeout
    const rpcProvider = new JsonRpcProvider(ARB_RPC);
    const receipt = await rpcProvider.waitForTransaction(tx.hash, 1, 60_000);

    if (!receipt) throw new Error('Transaction not confirmed');

    // Parse SessionCreated event to get the session ID
    const { address: contractAddr2, abi: abi2 } = getContractInfo();
    const readContract = new Contract(contractAddr2, abi2, rpcProvider);
    const event = receipt.logs.find(
      (log: any) => readContract.interface.parseLog(log)?.name === 'SessionCreated',
    );
    const parsed = readContract.interface.parseLog(event);
    const sessionId = Number(parsed!.args[0]);

    store.setContractSessionId(sessionId);
    store.setStatus(store.roulette ? 'waiting-vrf' : 'collecting');

    return sessionId;
  }, [getProvider, getContractInfo, store]);

  // Step 1.5 (roulette only): Poll for VRF fulfillment and fetch assigned shares
  const pollForShares = useCallback(async () => {
    if (!store.roulette || store.contractSessionId === null) return false;

    const rpcProvider = new JsonRpcProvider(ARB_RPC);
    const contract = new Contract(ROULETTE_ADDRESS, ROULETTE_ABI, rpcProvider);
    const assigned = await contract.areSharesAssigned(store.contractSessionId);

    if (!assigned) return false;

    // Fetch each participant's assigned share
    for (const p of store.participants) {
      const share = await contract.getShare(store.contractSessionId, p.address);
      store.updateParticipant(p.address, {
        shareAmount: Number(share),
      });
    }

    store.setStatus('collecting');
    return true;
  }, [getProvider, store]);

  // Step 2: Deposit the current user's share
  // sourceChainId: which chain the user is paying from (42161 = Arbitrum, direct deposit)
  const depositMyShare = useCallback(async (sourceChainId: number = 42161) => {
    if (!address) throw new Error('Wallet not connected');
    if (store.contractSessionId === null) throw new Error('No on-chain session');

    const participant = store.participants.find(
      (p) => p.address.toLowerCase() === address.toLowerCase(),
    );
    if (!participant) throw new Error('You are not a participant');

    // In roulette mode, share of 0 means you're lucky — no payment needed
    if (participant.shareAmount === 0) {
      store.updateParticipant(address, { status: 'deposited' });
      return 'free';
    }

    store.updateParticipant(address, { status: 'approved' });

    const provider = getProvider();
    const { address: contractAddr, abi } = getContractInfo();
    const shareAmount = participant.shareAmount.toString();
    const shareHuman = (participant.shareAmount / 1e6).toFixed(6);
    const rpcProvider = new JsonRpcProvider(ARB_RPC);

    // If paying from a different chain, bridge USDC to Arbitrum first via Arc
    if (sourceChainId !== 42161) {
      await bridgeUSDC({
        sourceChainId: sourceChainId as ArcChainId,
        destChainId: 42161,
        amount: shareHuman,
        recipient: address as `0x${string}`,
        provider,
      });

      // Switch wallet back to Arbitrum for the deposit
      try {
        const eip1193 = (walletProvider as any);
        await eip1193.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0xa4b1' }], // 42161
        });
        await new Promise((r) => setTimeout(r, 1000));
      } catch {}

      // Wait for CCTP to mint on Arbitrum (~1-2 min)
      // Poll for USDC balance on Arbitrum to confirm arrival
      const usdcRead = new Contract(USDC_ARB, ERC20_ABI, rpcProvider);
      const startBalance = await usdcRead.balanceOf(address);
      const targetBalance = BigInt(startBalance) + BigInt(shareAmount);

      let attempts = 0;
      while (attempts < 60) { // max 5 min
        await new Promise((r) => setTimeout(r, 5000));
        const currentBalance = await usdcRead.balanceOf(address);
        if (BigInt(currentBalance) >= targetBalance) break;
        attempts++;
      }
    }

    // Now deposit on Arbitrum
    const signer = await provider.getSigner();

    // Approve USDC spending on Arbitrum
    const usdc = new Contract(USDC_ARB, ERC20_ABI, signer);
    const approveTx = await usdc.approve(contractAddr, shareAmount);
    await rpcProvider.waitForTransaction(approveTx.hash, 1, 60_000);

    // Deposit into splitter
    const contract = new Contract(contractAddr, abi, signer);
    let depositTx;
    if (store.roulette) {
      depositTx = await contract.deposit(store.contractSessionId);
    } else {
      depositTx = await contract.deposit(store.contractSessionId, shareAmount);
    }
    await rpcProvider.waitForTransaction(depositTx.hash, 1, 60_000);

    store.updateParticipant(address, {
      status: 'deposited',
      txHash: depositTx.hash,
    });

    // Check if settled via direct RPC
    const readContract = new Contract(contractAddr, abi, rpcProvider);
    const session = await readContract.sessions(store.contractSessionId);
    if (session.settled) {
      store.setStatus('settled');

      // Confirm with WC Pay Gateway so the POS shows "paid"
      if (store.wcPaymentId) {
        const allTxHashes = store.participants
          .map((p) => p.txHash)
          .filter(Boolean) as string[];
        // Try to get options first (needed for optionId), then confirm
        const actions = await getWcPayActions(store.wcPaymentId, address!);
        if (actions) {
          await confirmWcPayment(store.wcPaymentId, actions.optionId, allTxHashes);
        } else {
          // If options unavailable, try confirm with a dummy optionId
          await confirmWcPayment(store.wcPaymentId, 'default', allTxHashes);
        }
      }
    }

    return depositTx.hash;
  }, [getProvider, getContractInfo, address, store]);

  // Poll session status from the contract
  const refreshStatus = useCallback(async () => {
    if (store.contractSessionId === null) return;

    const rpcProvider = new JsonRpcProvider(ARB_RPC);
    const { address: contractAddr, abi } = getContractInfo();
    const contract = new Contract(contractAddr, abi, rpcProvider);
    const session = await contract.sessions(store.contractSessionId);

    if (session.settled && store.status !== 'settled') {
      store.setStatus('settled');

      // Confirm with WC Pay Gateway
      if (store.wcPaymentId && address) {
        const allTxHashes = store.participants
          .map((p) => p.txHash)
          .filter(Boolean) as string[];
        const actions = await getWcPayActions(store.wcPaymentId, address);
        if (actions) {
          await confirmWcPayment(store.wcPaymentId, actions.optionId, allTxHashes);
        } else {
          await confirmWcPayment(store.wcPaymentId, 'default', allTxHashes);
        }
      }
    }

    return {
      collected: session.collected.toString(),
      total: session.totalAmount.toString(),
      settled: session.settled,
    };
  }, [getProvider, getContractInfo, store, address]);

  return {
    createOnChainSession,
    pollForShares,
    depositMyShare,
    refreshStatus,
    ...store,
  };
}
