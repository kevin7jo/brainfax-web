import { parseEther, parseUnits } from 'viem';
import type { PaymentMethod } from './cryptoPayment';
import type { BillingPricesSnapshot } from './billingPrices';
import {
  BFAX_TOKEN_PAYMENT_BONUS_PERCENT,
  ORACLE_TOKEN_DECIMALS,
  PACKAGE_VOLUME_BONUS_PERCENT,
  computeSaaSCreditsForPackage,
  getRechargePackage,
  type PackageId,
} from './bfaxOracle';

export type PackagePaymentQuote = {
  packageId: PackageId;
  packageUsd: number;
  paymentMethod: PaymentMethod;
  unitPriceUsd: number;
  amountHuman: string;
  amountWei: bigint;
  decimals: number;
  queueCredits: number;
  volumeBonusPercent: number;
  web3BonusPercent: number;
};

export function getUnitPriceUsd(
  prices: BillingPricesSnapshot,
  method: PaymentMethod
): number {
  switch (method) {
    case 'POL':
      return prices.pol.effectivePriceUsd;
    case 'BFAX':
      return prices.bfax.effectivePriceUsd;
    case 'USDT':
      return prices.usdt.effectivePriceUsd;
    case 'USDC':
      return prices.usdc.effectivePriceUsd;
    default:
      return 1;
  }
}

/** 패키지 USD / 코인 USD 시세 → 정밀 청구 수량 */
export function computePackagePaymentQuote(params: {
  packageId: PackageId;
  paymentMethod: PaymentMethod;
  prices: BillingPricesSnapshot;
  tokenDecimals?: number;
}): PackagePaymentQuote {
  const pkg = getRechargePackage(params.packageId);
  const unitPriceUsd = getUnitPriceUsd(params.prices, params.paymentMethod);
  if (!Number.isFinite(unitPriceUsd) || unitPriceUsd <= 0) {
    throw new Error('유효한 오라클 시세가 없습니다.');
  }

  const rawAmount = pkg.usdValue / unitPriceUsd;
  const decimals =
    params.paymentMethod === 'POL' ? 18 : (params.tokenDecimals ?? 6);

  const amountHuman =
    params.paymentMethod === 'POL'
      ? rawAmount.toFixed(8)
      : rawAmount.toFixed(Math.min(decimals, ORACLE_TOKEN_DECIMALS));

  const amountWei =
    params.paymentMethod === 'POL'
      ? parseEther(amountHuman)
      : parseUnits(amountHuman, decimals);

  return {
    packageId: params.packageId,
    packageUsd: pkg.usdValue,
    paymentMethod: params.paymentMethod,
    unitPriceUsd,
    amountHuman,
    amountWei,
    decimals,
    queueCredits: computeSaaSCreditsForPackage(params.packageId, params.paymentMethod),
    volumeBonusPercent: PACKAGE_VOLUME_BONUS_PERCENT[params.packageId],
    web3BonusPercent: params.paymentMethod === 'BFAX' ? BFAX_TOKEN_PAYMENT_BONUS_PERCENT : 0,
  };
}

export function formatBonusStackLabel(quote: PackagePaymentQuote): string | null {
  if (quote.paymentMethod !== 'BFAX') {
    if (quote.volumeBonusPercent > 0) return `+${quote.volumeBonusPercent}% Vol`;
    return null;
  }
  const total =
    quote.volumeBonusPercent + quote.web3BonusPercent;
  if (total <= 0) return `+${quote.web3BonusPercent}% Web3`;
  return `+${quote.volumeBonusPercent}% Vol · +${quote.web3BonusPercent}% Web3 (=+${total}% stack)`;
}
