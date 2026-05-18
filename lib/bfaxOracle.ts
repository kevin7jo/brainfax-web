import { formatUnits, parseUnits } from 'viem';
import type { PaymentMethod } from './cryptoPayment';

/** BFAX 가치 하한선 방어막 — 플랫폼 내부 최소 $0.10 */
export const BFAX_PRICE_FLOOR_USD = 0.1;

/** BFAX ERC-20 토큰 결제 시 SaaS 크레딧 +10% 보너스 */
export const BFAX_TOKEN_PAYMENT_BONUS_PERCENT = 10;

/** 오라클 가격 소수 자릿수 (클라이언트·서버 동기화) */
export const ORACLE_TOKEN_DECIMALS = 6;

export type PackageId = 'tier1' | 'tier2' | 'tier3';

export type RechargePackage = {
  id: PackageId;
  label: string;
  usdValue: number;
  saasCredits: number;
  polAmount: string;
};

/** 고정 달러 가치 패키지 (전술 B 오라클 정산) */
export const RECHARGE_PACKAGES: Record<PackageId, RechargePackage> = {
  tier1: {
    id: 'tier1',
    label: 'Standard Bundle',
    usdValue: 10,
    saasCredits: 100,
    polAmount: '10',
  },
  tier2: {
    id: 'tier2',
    label: 'Professional Bundle',
    usdValue: 50,
    saasCredits: 500,
    polAmount: '50',
  },
  tier3: {
    id: 'tier3',
    label: 'Enterprise Bundle',
    usdValue: 100,
    saasCredits: 1000,
    polAmount: '100',
  },
};

export type BfaxOracleSnapshot = {
  marketPriceUsd: number;
  effectivePriceUsd: number;
  priceFloorUsd: number;
  source: string;
  updatedAt: string;
};

export function applyBfaxPriceFloor(marketPriceUsd: number): number {
  if (!Number.isFinite(marketPriceUsd) || marketPriceUsd <= 0) {
    return BFAX_PRICE_FLOOR_USD;
  }
  return Math.max(marketPriceUsd, BFAX_PRICE_FLOOR_USD);
}

/**
 * QuickSwap / DEX 시세 피드 (현재: 가상 오라클 $1.00)
 * QUICKSWAP_BFAX_PRICE_URL 설정 시 외부 JSON { priceUsd: number } 파싱
 */
export async function fetchMarketBfaxPriceUsd(): Promise<{ priceUsd: number; source: string }> {
  const dexUrl = process.env.QUICKSWAP_BFAX_PRICE_URL?.trim();

  if (dexUrl) {
    try {
      const res = await fetch(dexUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = (await res.json()) as { priceUsd?: number; price?: number; usd?: number };
        const raw = data.priceUsd ?? data.price ?? data.usd;
        const price = Number(raw);
        if (Number.isFinite(price) && price > 0) {
          return { priceUsd: price, source: 'quickswap-dex-api' };
        }
      }
    } catch (e) {
      console.warn('[bfaxOracle] DEX price fetch failed, using mock feed', e);
    }
  }

  const mock = Number(process.env.MOCK_BFAX_PRICE_USD ?? '1');
  return {
    priceUsd: Number.isFinite(mock) && mock > 0 ? mock : 1,
    source: 'mock-oracle',
  };
}

export async function getBfaxOracleSnapshot(): Promise<BfaxOracleSnapshot> {
  const { priceUsd: marketPriceUsd, source } = await fetchMarketBfaxPriceUsd();
  const effectivePriceUsd = applyBfaxPriceFloor(marketPriceUsd);

  return {
    marketPriceUsd,
    effectivePriceUsd,
    priceFloorUsd: BFAX_PRICE_FLOOR_USD,
    source,
    updatedAt: new Date().toISOString(),
  };
}

export function isPackageId(value: string): value is PackageId {
  return value === 'tier1' || value === 'tier2' || value === 'tier3';
}

export function getRechargePackage(packageId: PackageId): RechargePackage {
  return RECHARGE_PACKAGES[packageId];
}

/** 가변 청구 BFAX 토큰 수량 = 패키지 USD / effective BFAX 가격 */
export function computeVariableBfaxTokenCharge(params: {
  packageUsd: number;
  effectivePriceUsd: number;
  tokenDecimals?: number;
}): { tokenAmountHuman: string; tokenAmountWei: bigint; tokenDecimals: number } {
  const tokenDecimals = params.tokenDecimals ?? 18;
  const raw = params.packageUsd / params.effectivePriceUsd;
  const tokenAmountHuman = raw.toFixed(ORACLE_TOKEN_DECIMALS);
  const tokenAmountWei = parseUnits(tokenAmountHuman, tokenDecimals);
  return { tokenAmountHuman, tokenAmountWei, tokenDecimals };
}

export function computeSaaSCreditsForPackage(
  packageId: PackageId,
  paymentMethod: PaymentMethod
): number {
  const pkg = RECHARGE_PACKAGES[packageId];
  let credits = pkg.saasCredits;
  if (paymentMethod === 'BFAX') {
    credits = Math.floor(credits * (1 + BFAX_TOKEN_PAYMENT_BONUS_PERCENT / 100));
  }
  return credits;
}

export function formatOracleQuoteForUi(params: {
  packageId: PackageId;
  effectivePriceUsd: number;
  marketPriceUsd: number;
  tokenDecimals?: number;
}): {
  packageUsd: number;
  tokenAmountHuman: string;
  saasCredits: number;
  bonusApplied: boolean;
} {
  const pkg = getRechargePackage(params.packageId);
  const { tokenAmountHuman } = computeVariableBfaxTokenCharge({
    packageUsd: pkg.usdValue,
    effectivePriceUsd: params.effectivePriceUsd,
    tokenDecimals: params.tokenDecimals,
  });
  const saasCredits = computeSaaSCreditsForPackage(params.packageId, 'BFAX');
  return {
    packageUsd: pkg.usdValue,
    tokenAmountHuman,
    saasCredits,
    bonusApplied: true,
  };
}

export function weiToHumanAmount(wei: bigint, decimals: number): string {
  return formatUnits(wei, decimals);
}
