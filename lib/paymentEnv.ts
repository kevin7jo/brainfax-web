import type { PaymentMethod } from './cryptoPayment';

/** 코드·문서 공통 — CONTRACT_ADDRESS 우선, TOKEN_ADDRESS 별칭 폴백 */
export const TOKEN_CONTRACT_ENV_KEYS: Record<
  Exclude<PaymentMethod, 'POL'>,
  readonly [string, string]
> = {
  BFAX: ['NEXT_PUBLIC_BFAX_CONTRACT_ADDRESS', 'NEXT_PUBLIC_BFAX_TOKEN_ADDRESS'],
  USDT: ['NEXT_PUBLIC_USDT_CONTRACT_ADDRESS', 'NEXT_PUBLIC_USDT_TOKEN_ADDRESS'],
  USDC: ['NEXT_PUBLIC_USDC_CONTRACT_ADDRESS', 'NEXT_PUBLIC_USDC_TOKEN_ADDRESS'],
};

export function readHexAddressFromEnv(keys: readonly string[]): `0x${string}` | null {
  for (const key of keys) {
    const addr = process.env[key]?.trim();
    if (addr && /^0x[a-fA-F0-9]{40}$/i.test(addr)) {
      return addr as `0x${string}`;
    }
  }
  return null;
}

export function readRequiredTokenContractAddress(method: Exclude<PaymentMethod, 'POL'>): string {
  const keys = TOKEN_CONTRACT_ENV_KEYS[method];
  const addr = readHexAddressFromEnv(keys);
  if (!addr) {
    throw new Error(`${keys[0]} 또는 ${keys[1]}가 유효하지 않습니다.`);
  }
  return addr;
}
