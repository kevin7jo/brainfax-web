import type { PaymentMethod } from './cryptoPayment';
import { getErc20TransferRecipient } from './bfaxBurn';
import { TOKEN_CONTRACT_ENV_KEYS } from './paymentEnv';

/**
 * Next.js 클라이언트 번들은 process.env.NEXT_PUBLIC_* 를
 * 정적 속성 접근(process.env.NEXT_PUBLIC_FOO)으로만 인라인합니다.
 * process.env[variable] 동적 접근은 브라우저에서 항상 undefined 입니다.
 */
function pickValidAddress(...candidates: (string | undefined)[]): `0x${string}` | null {
  for (const raw of candidates) {
    const addr = raw?.trim();
    if (addr && /^0x[a-fA-F0-9]{40}$/i.test(addr)) {
      return addr as `0x${string}`;
    }
  }
  return null;
}

export function getTreasuryAddressClient(): `0x${string}` | null {
  return pickValidAddress(process.env.NEXT_PUBLIC_TREASURY_ADDRESS);
}

export function getPaymentTokenContract(method: PaymentMethod): `0x${string}` | null {
  switch (method) {
    case 'BFAX':
      return pickValidAddress(
        process.env.NEXT_PUBLIC_BFAX_CONTRACT_ADDRESS,
        process.env.NEXT_PUBLIC_BFAX_TOKEN_ADDRESS
      );
    case 'USDT':
      return pickValidAddress(
        process.env.NEXT_PUBLIC_USDT_CONTRACT_ADDRESS,
        process.env.NEXT_PUBLIC_USDT_TOKEN_ADDRESS
      );
    case 'USDC':
      return pickValidAddress(
        process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS,
        process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS
      );
    case 'POL':
      return null;
    default:
      return null;
  }
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BFAX: 'BFAX Token',
  POL: 'POL',
  USDT: 'USDT',
  USDC: 'USDC',
};

export function getTokenContractEnvHint(method: PaymentMethod): string | null {
  if (method === 'POL') return null;
  const keys = TOKEN_CONTRACT_ENV_KEYS[method];
  return `${keys[0]} 또는 ${keys[1]}`;
}

/** POL → treasury, BFAX → burn, USDT/USDC → treasury */
export function getTransferDestinationClient(
  paymentMethod: PaymentMethod,
  treasury: `0x${string}`
): `0x${string}` {
  if (paymentMethod === 'POL') return treasury;
  return getErc20TransferRecipient(paymentMethod, treasury);
}
