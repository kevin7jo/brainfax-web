import type { PaymentMethod } from './cryptoPayment';
import { readHexAddressFromEnv, TOKEN_CONTRACT_ENV_KEYS } from './paymentEnv';

export function getTreasuryAddressClient(): `0x${string}` | null {
  return readHexAddressFromEnv(['NEXT_PUBLIC_TREASURY_ADDRESS']);
}

export function getPaymentTokenContract(method: PaymentMethod): `0x${string}` | null {
  if (method === 'POL') return null;
  return readHexAddressFromEnv(TOKEN_CONTRACT_ENV_KEYS[method]);
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
