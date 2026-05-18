import type { PaymentMethod } from './cryptoPayment';

/** EVM 공식 영구 소각 주소 (BFAX Token 결제 전용) */
export const BFAX_BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD' as const;

export const BFAX_BURN_POLYGONSCAN_URL =
  'https://polygonscan.com/address/0x000000000000000000000000000000000000dEaD';

export function isBfaxBurnPayment(method: PaymentMethod): boolean {
  return method === 'BFAX';
}

/** ERC-20 transfer 수신 주소: BFAX → burn, 그 외 → treasury */
export function getErc20TransferRecipient(
  paymentMethod: PaymentMethod,
  treasuryAddress: string
): `0x${string}` {
  if (isBfaxBurnPayment(paymentMethod)) {
    return BFAX_BURN_ADDRESS;
  }
  return treasuryAddress as `0x${string}`;
}
