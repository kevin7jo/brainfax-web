import { formatUnits, parseUnits } from 'viem';
import type { PaymentMethod } from './cryptoPayment';
import { readHexAddressFromEnv, TOKEN_CONTRACT_ENV_KEYS } from './paymentEnv';

/** BFAX 가치 하한선 방어막 — 플랫폼 내부 최소 $0.10 */
export const BFAX_PRICE_FLOOR_USD = 0.1;

/** BFAX ERC-20 토큰 결제 시 SaaS 크레딧 +10% 보너스 */
export const BFAX_TOKEN_PAYMENT_BONUS_PERCENT = 10;

/** 오라클 가격 소수 자릿수 (클라이언트·서버 동기화) */
export const ORACLE_TOKEN_DECIMALS = 6;

export type PackageId = 'tier1' | 'tier2' | 'tier3';

/** 패키지별 볼륨 보너스 (POL·토큰 공통 1차 적용) */
export const PACKAGE_VOLUME_BONUS_PERCENT: Record<PackageId, number> = {
  tier1: 0,
  tier2: 2,
  tier3: 3,
};

export type RechargePackage = {
  id: PackageId;
  label: string;
  usdValue: number;
  /** 보너스 적용 전 기준 Queue */
  bfaxQueueBase: number;
  polAmount: string;
  /** POL 결제 적립 (볼륨 보너스 반영) */
  bfaxQueuePol: number;
  /** BFAX Token 결제 적립 (볼륨 + 토큰 결제 +10% 중첩) */
  bfaxQueueToken: number;
  /** @deprecated bfaxQueueBase와 동일 — 하위 호환 */
  saasCredits: number;
};

/** 고정 달러 가치 패키지 (전술 B 오라클 정산) */
export const RECHARGE_PACKAGES: Record<PackageId, RechargePackage> = {
  tier1: {
    id: 'tier1',
    label: 'Standard Bundle',
    usdValue: 10,
    bfaxQueueBase: 100,
    polAmount: '10',
    bfaxQueuePol: 100,
    bfaxQueueToken: 110,
    saasCredits: 100,
  },
  tier2: {
    id: 'tier2',
    label: 'Professional Bundle (+2% Vol)',
    usdValue: 50,
    bfaxQueueBase: 500,
    polAmount: '50',
    bfaxQueuePol: 510,
    bfaxQueueToken: 560,
    saasCredits: 500,
  },
  tier3: {
    id: 'tier3',
    label: 'Enterprise Bundle (+3% Vol)',
    usdValue: 100,
    bfaxQueueBase: 1000,
    polAmount: '100',
    bfaxQueuePol: 1030,
    bfaxQueueToken: 1130,
    saasCredits: 1000,
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

type DexScreenerPair = {
  chainId?: string;
  dexId?: string;
  priceUsd?: string;
  liquidity?: { usd?: number };
};

type DexScreenerResponse = {
  pairs?: DexScreenerPair[];
};

function getBfaxContractFromEnv(): string | null {
  return readHexAddressFromEnv(TOKEN_CONTRACT_ENV_KEYS.BFAX);
}

/** Polygon QuickSwap 풀 우선 — Dexscreener 실시간 USD 시세 */
function pickBestDexPair(pairs: DexScreenerPair[]): DexScreenerPair | null {
  const withPrice = pairs.filter((p) => {
    const n = Number(p.priceUsd);
    return Number.isFinite(n) && n > 0;
  });
  if (!withPrice.length) return null;

  const onPolygon = withPrice.filter((p) => p.chainId === 'polygon');
  const pool = onPolygon.length > 0 ? onPolygon : withPrice;

  const quickswap = pool.find((p) => p.dexId?.toLowerCase() === 'quickswap');
  if (quickswap) return quickswap;

  return pool.sort(
    (a, b) => Number(b.liquidity?.usd ?? 0) - Number(a.liquidity?.usd ?? 0)
  )[0];
}

export async function fetchDexScreenerBfaxPriceUsd(
  contractAddress: string,
  options?: { revalidateSeconds?: number; fresh?: boolean }
): Promise<{ priceUsd: number; source: string }> {
  const url = `https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`;

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    ...(options?.fresh
      ? { cache: 'no-store' as const }
      : { next: { revalidate: options?.revalidateSeconds ?? 10 } }),
  });

  if (!response.ok) {
    throw new Error(`Dexscreener HTTP ${response.status}`);
  }

  const data = (await response.json()) as DexScreenerResponse;
  const best = pickBestDexPair(data.pairs ?? []);
  const livePrice = best ? Number(best.priceUsd) : 0;

  if (!Number.isFinite(livePrice) || livePrice <= 0) {
    return {
      priceUsd: BFAX_PRICE_FLOOR_USD,
      source: 'live:dexscreener (no-liquidity-pool, floor fallback)',
    };
  }

  const floorActive = livePrice < BFAX_PRICE_FLOOR_USD;
  return {
    priceUsd: livePrice,
    source: floorActive
      ? 'live:dexscreener (price-floor-guard-pending)'
      : `live:dexscreener:${best.dexId ?? 'polygon'}`,
  };
}

/**
 * BFAX/USD 시세 피드
 * 1) Dexscreener (NEXT_PUBLIC_BFAX_CONTRACT_ADDRESS)
 * 2) QUICKSWAP_BFAX_PRICE_URL 커스텀 JSON
 * 3) MOCK_BFAX_PRICE_USD / fail-safe $0.10
 */
export async function fetchMarketBfaxPriceUsd(options?: {
  revalidateSeconds?: number;
  fresh?: boolean;
}): Promise<{ priceUsd: number; source: string }> {
  const contract = getBfaxContractFromEnv();

  if (contract) {
    try {
      return await fetchDexScreenerBfaxPriceUsd(contract, options);
    } catch (e) {
      console.warn('[bfaxOracle] Dexscreener oracle failed, trying fallbacks', e);
    }
  }

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
          return { priceUsd: price, source: 'custom-dex-api' };
        }
      }
    } catch (e) {
      console.warn('[bfaxOracle] custom DEX URL failed', e);
    }
  }

  if (process.env.NODE_ENV === 'development') {
    const mock = Number(process.env.MOCK_BFAX_PRICE_USD ?? '1');
    if (Number.isFinite(mock) && mock > 0) {
      return { priceUsd: mock, source: 'mock-oracle-dev' };
    }
  }

  return { priceUsd: BFAX_PRICE_FLOOR_USD, source: 'fail-safe:backup-oracle' };
}

export async function getBfaxOracleSnapshot(options?: {
  revalidateSeconds?: number;
  /** 결제 검증 시 최신 시세 강제 (캐시 미사용) */
  fresh?: boolean;
}): Promise<BfaxOracleSnapshot> {
  const { priceUsd: marketPriceUsd, source } = await fetchMarketBfaxPriceUsd(options);
  const effectivePriceUsd = applyBfaxPriceFloor(marketPriceUsd);
  const floorActive = marketPriceUsd < BFAX_PRICE_FLOOR_USD;

  return {
    marketPriceUsd,
    effectivePriceUsd,
    priceFloorUsd: BFAX_PRICE_FLOOR_USD,
    source: floorActive ? `${source} (price-floor-guard-active)` : source,
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

/** 볼륨 보너스 + (선택) 토큰 결제 +10% 중첩 — UI·서버 단일 소스 */
export function computeBfaxQueueCredits(
  base: number,
  volumeBonusPercent: number,
  paymentMethod: PaymentMethod
): number {
  let multiplier = 1 + volumeBonusPercent / 100;
  if (paymentMethod === 'BFAX') {
    multiplier += BFAX_TOKEN_PAYMENT_BONUS_PERCENT / 100;
  }
  return Math.floor(base * multiplier);
}

export function computeSaaSCreditsForPackage(
  packageId: PackageId,
  paymentMethod: PaymentMethod
): number {
  const pkg = RECHARGE_PACKAGES[packageId];
  return paymentMethod === 'BFAX' ? pkg.bfaxQueueToken : pkg.bfaxQueuePol;
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
