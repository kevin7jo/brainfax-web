export type PaymentMethod = 'POL' | 'BFAX' | 'USDT' | 'USDC';

export const CRYPTO_LEDGER_STATUS = {
  POL: 'CRYPTO_RECHARGE',
  BFAX: 'CRYPTO_BFAX_RECHARGE',
  USDT: 'CRYPTO_USDT_RECHARGE',
  USDC: 'CRYPTO_USDC_RECHARGE',
} as const satisfies Record<PaymentMethod, string>;

/** ERC-20 Transfer(address,address,uint256) */
export const ERC20_TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' as const;

export const PAYMENT_METHODS: PaymentMethod[] = ['BFAX', 'POL', 'USDT', 'USDC'];

export function isPaymentMethod(value: string): value is PaymentMethod {
  return PAYMENT_METHODS.includes(value as PaymentMethod);
}

export function isErc20PaymentMethod(method: PaymentMethod): boolean {
  return method === 'BFAX' || method === 'USDT' || method === 'USDC';
}
