import type { PaymentMethod } from './cryptoPayment';

function readAddress(envKey: string): `0x${string}` | null {
  const addr = process.env[envKey]?.trim();
  if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr)) return null;
  return addr as `0x${string}`;
}

export function getTreasuryAddressClient(): `0x${string}` | null {
  return readAddress('NEXT_PUBLIC_TREASURY_ADDRESS');
}

export function getPaymentTokenContract(method: PaymentMethod): `0x${string}` | null {
  switch (method) {
    case 'BFAX':
      return readAddress('NEXT_PUBLIC_BFAX_CONTRACT_ADDRESS');
    case 'USDT':
      return readAddress('NEXT_PUBLIC_USDT_CONTRACT_ADDRESS');
    case 'USDC':
      return readAddress('NEXT_PUBLIC_USDC_CONTRACT_ADDRESS');
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
