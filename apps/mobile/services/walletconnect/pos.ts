/**
 * Parse WalletConnect POS QR codes and resolve payment details.
 *
 * Supported formats:
 * 1. WC Pay URL:  https://pay.walletconnect.com/pay_xxx
 * 2. WC Pay URL:  https://pay.walletconnect.com/?pid=pay_xxx
 * 3. ERC-681:     ethereum:0xAddr@chainId/transfer?address=0xToken&uint256=amount
 * 4. Simple JSON: { merchant: "0x...", amount: "1000000", chainId: 42161 }
 */

import { projectId } from './appkit';

const WC_PAY_API_KEY = process.env.EXPO_PUBLIC_WC_PAY_API_KEY || '';

const PAY_HOST = 'pay.walletconnect.com';
const GATEWAY_BASE = 'https://api.pay.walletconnect.com';

export interface POSPayment {
  merchantAddress: string;
  merchantName?: string;
  amountRaw: string; // USDC 6-decimal raw amount
  chainId: number;
  paymentId?: string;
  collectUrl?: string;
  source: 'wc-pay' | 'erc681' | 'json';
}

/**
 * Extract WC Pay payment ID from a scanned string.
 * Returns null if it's not a WC Pay link.
 */
function extractPaymentId(data: string): string | null {
  // Format: pay_xxx (bare ID)
  if (/^pay_[a-zA-Z0-9]+$/.test(data)) return data;

  try {
    // Format: https://pay.walletconnect.com/pay_xxx
    // Format: https://pay.walletconnect.com/?pid=pay_xxx
    const url = new URL(data);
    if (!url.hostname.endsWith(PAY_HOST)) return null;

    // Path-based: /pay_xxx
    const pathMatch = url.pathname.match(/\/(pay_[a-zA-Z0-9]+)/);
    if (pathMatch) return pathMatch[1];

    // Query-based: ?pid=pay_xxx
    const pid = url.searchParams.get('pid');
    if (pid?.startsWith('pay_')) return pid;

    return null;
  } catch {
    // Not a URL — check if it's a wc: URI with pay param
    if (data.startsWith('wc:')) {
      const payParam = data.match(/pay=([^&]+)/);
      if (payParam) {
        const decoded = decodeURIComponent(payParam[1]);
        return extractPaymentId(decoded);
      }
    }
    return null;
  }
}

/**
 * Call WC Pay Gateway to get payment options (merchant address, amount).
 */
async function resolveWcPayment(
  paymentId: string,
  userAddress: string,
): Promise<POSPayment | null> {
  try {
    // Fetch payment options from the Gateway API
    // First try GET to fetch payment info (amount, merchant)
    const infoRes = await fetch(
      `${GATEWAY_BASE}/v1/gateway/payment/${paymentId}`,
      {
        headers: {
          'Api-Key': WC_PAY_API_KEY,
        },
      },
    );

    if (!infoRes.ok) {
      console.warn('WC Pay info error:', infoRes.status);
      return null;
    }

    const info = await infoRes.json();
    console.log('WC Pay info response:', JSON.stringify(info, null, 2));

    // Parse amount: { unit: "iso4217/USD", value: "10", display: { decimals: 2 } }
    // value "10" with decimals 2 means $0.10
    const amountInfo = info.amount || {};
    const decimals = amountInfo.display?.decimals || 2;
    const rawValue = parseInt(amountInfo.value || '0', 10);
    // Convert to USDC 6-decimal raw: value is in smallest fiat unit (cents if decimals=2)
    // e.g. value=10, decimals=2 means $0.10 = 0.10 USDC = 100000 raw (6 decimals)
    const usdAmount = rawValue / Math.pow(10, decimals);
    const amountRaw = Math.round(usdAmount * 1e6).toString();

    const merchantName = info.merchant?.name || 'Merchant';

    // Also fetch options to get the collectUrl for KYC
    let collectUrl: string | undefined;
    try {
      const optionsRes = await fetch(
        `${GATEWAY_BASE}/v1/gateway/payment/${paymentId}/options`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Api-Key': WC_PAY_API_KEY,
          },
          body: JSON.stringify({
            accounts: [
              `eip155:42161:${userAddress}`,
              `eip155:8453:${userAddress}`,
              `eip155:1:${userAddress}`,
            ],
          }),
        },
      );
      if (optionsRes.ok) {
        const optionsData = await optionsRes.json();
        console.log('WC Pay options collectData:', JSON.stringify(optionsData.collectData || optionsData.info?.collectData, null, 2));
        collectUrl =
          optionsData.collectData?.url ||
          optionsData.info?.collectData?.url ||
          optionsData.info?.collect?.url;
        console.log('WC Pay collectUrl:', collectUrl);
      }
    } catch {}

    return {
      merchantAddress: userAddress,
      merchantName,
      amountRaw,
      collectUrl,
      chainId: 42161,
      paymentId,
      source: 'wc-pay',
    };
  } catch (err) {
    console.warn('WC Pay resolve error:', err);
    return null;
  }
}

/**
 * Try to parse a scanned QR string into payment details.
 * Returns null if the format is not recognized.
 */
export async function parsePOSQR(
  data: string,
  userAddress?: string,
): Promise<POSPayment | null> {
  // Try WC Pay format first
  const paymentId = extractPaymentId(data);
  if (paymentId) {
    if (userAddress) {
      const resolved = await resolveWcPayment(paymentId, userAddress);
      if (resolved) return resolved;
    }
    // If gateway fails, return a placeholder so we can still show the payment ID
    return {
      merchantAddress: '',
      amountRaw: '0',
      chainId: 42161,
      paymentId,
      source: 'wc-pay',
    };
  }

  // Try WC Pay URL with query params (amount + recipient in URL)
  const wcPayUrl = tryParseWcPayUrl(data);
  if (wcPayUrl) return wcPayUrl;

  // Try ERC-681 format
  const erc681 = tryParseERC681(data);
  if (erc681) return erc681;

  // Try simple JSON
  const json = tryParseJSON(data);
  if (json) return json;

  return null;
}

/**
 * Synchronous check: is this data potentially a POS QR code?
 * Used for quick detection before async resolution.
 */
export function isPOSQR(data: string): boolean {
  if (extractPaymentId(data)) return true;
  if (data.includes('walletconnect.com') || data.includes('reown.com')) return true;
  if (data.startsWith('ethereum:')) return true;
  try {
    const obj = JSON.parse(data);
    if (obj.merchant && obj.amount) return true;
  } catch {}
  return false;
}

function tryParseWcPayUrl(data: string): POSPayment | null {
  try {
    if (!data.includes('walletconnect.com') && !data.includes('reown.com')) return null;

    const url = new URL(data);
    const recipient = url.searchParams.get('recipient') || url.searchParams.get('address');
    const amount = url.searchParams.get('amount');

    if (!recipient || !amount) return null;

    const amountRaw = Math.round(parseFloat(amount) * 1e6).toString();
    const network = url.searchParams.get('network') || '';
    const chainId = network.includes(':') ? parseInt(network.split(':')[1]) : 42161;

    return {
      merchantAddress: recipient,
      amountRaw,
      chainId,
      source: 'wc-pay',
    };
  } catch {
    return null;
  }
}

function tryParseERC681(data: string): POSPayment | null {
  try {
    if (!data.startsWith('ethereum:')) return null;

    const rest = data.slice('ethereum:'.length);
    const [addrPart, queryPart] = rest.split('/transfer?');
    if (!addrPart || !queryPart) return null;

    const [address, chainIdStr] = addrPart.split('@');
    const params = new URLSearchParams(queryPart);
    const amount = params.get('uint256');

    if (!address || !amount) return null;

    return {
      merchantAddress: address,
      amountRaw: amount,
      chainId: chainIdStr ? parseInt(chainIdStr) : 42161,
      source: 'erc681',
    };
  } catch {
    return null;
  }
}

function tryParseJSON(data: string): POSPayment | null {
  try {
    const obj = JSON.parse(data);
    if (obj.merchant && obj.amount) {
      return {
        merchantAddress: obj.merchant,
        amountRaw: typeof obj.amount === 'number'
          ? Math.round(obj.amount * 1e6).toString()
          : obj.amount,
        chainId: obj.chainId || 42161,
        source: 'json',
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get payment options from the WC Pay Gateway, then fetch the signing actions.
 * Returns the transaction params that need to be signed to complete the payment.
 */
export async function getWcPayActions(
  paymentId: string,
  userAddress: string,
): Promise<{ optionId: string; actions: any[] } | null> {
  try {
    // Step 1: Get payment options
    const optionsRes = await fetch(
      `${GATEWAY_BASE}/v1/gateway/payment/${paymentId}/options`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': WC_PAY_API_KEY,
        },
        body: JSON.stringify({
          accounts: [
            `eip155:42161:${userAddress}`,
            `eip155:8453:${userAddress}`,
            `eip155:1:${userAddress}`,
          ],
        }),
      },
    );

    if (!optionsRes.ok) {
      console.warn('WC Pay options error:', optionsRes.status);
      return null;
    }

    const optionsData = await optionsRes.json();
    console.log('WC Pay options:', JSON.stringify(optionsData, null, 2));

    const options = optionsData.options || [];
    if (options.length === 0) {
      console.warn('WC Pay: no payment options available');
      return null;
    }

    // Pick the first option
    const option = options[0];
    const optionId = option.id;

    // Step 2: Fetch/resolve any build actions
    const actions = option.actions || [];
    const resolvedActions: any[] = [];

    for (const action of actions) {
      if (action.type === 'build') {
        const fetchRes = await fetch(
          `${GATEWAY_BASE}/v1/gateway/payment/${paymentId}/fetch`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Api-Key': WC_PAY_API_KEY,
            },
            body: JSON.stringify({
              optionId,
              data: action.data,
            }),
          },
        );

        if (fetchRes.ok) {
          const fetchData = await fetchRes.json();
          resolvedActions.push(...(fetchData.actions || []));
        }
      } else {
        resolvedActions.push(action);
      }
    }

    return { optionId, actions: resolvedActions };
  } catch (err) {
    console.warn('WC Pay actions error:', err);
    return null;
  }
}

/**
 * Confirm a WC Pay payment with transaction results.
 * Call this after settlement to notify the POS that payment is complete.
 */
export async function confirmWcPayment(
  paymentId: string,
  optionId: string,
  txHashes: string[],
): Promise<{ status: string; isFinal: boolean } | null> {
  try {
    const res = await fetch(
      `${GATEWAY_BASE}/v1/gateway/payment/${paymentId}/confirm?maxPollMs=5000`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': WC_PAY_API_KEY,
        },
        body: JSON.stringify({
          optionId,
          results: txHashes.map((hash) => ({
            type: 'walletRpc',
            data: [hash],
          })),
        }),
      },
    );

    if (!res.ok) {
      console.warn('WC Pay confirm error:', res.status, await res.text());
      return null;
    }

    const data = await res.json();
    console.log('WC Pay confirm response:', JSON.stringify(data, null, 2));
    return { status: data.status, isFinal: data.isFinal };
  } catch (err) {
    console.warn('WC Pay confirm error:', err);
    return null;
  }
}
