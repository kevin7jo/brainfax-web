import {
  BFAX_PRICE_FLOOR_USD,
  applyBfaxPriceFloor,
  fetchMarketBfaxPriceUsd,
} from './bfaxOracle';

export const STABLECOIN_USD_PRICE = 1.0;

export type BillingPriceFeed = {
  marketPriceUsd: number;
  effectivePriceUsd: number;
  source: string;
};

export type BillingPricesSnapshot = {
  pol: BillingPriceFeed;
  bfax: BillingPriceFeed & { priceFloorUsd: number };
  usdt: BillingPriceFeed;
  usdc: BillingPriceFeed;
  updatedAt: string;
};

async function fetchBinanceSymbolPriceUsd(symbol: string): Promise<number | null> {
  const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 10 },
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { price?: string };
  const price = Number(data.price);
  return Number.isFinite(price) && price > 0 ? price : null;
}

/** POL/USD — Binance POLUSDT → MATICUSDT 폴백 */
export async function fetchPolPriceUsd(options?: {
  fresh?: boolean;
}): Promise<{ priceUsd: number; source: string }> {
  const fetchOpts = options?.fresh ? { cache: 'no-store' as const } : { next: { revalidate: 10 } };

  for (const symbol of ['POLUSDT', 'MATICUSDT']) {
    try {
      const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        ...fetchOpts,
      });
      if (!response.ok) continue;
      const data = (await response.json()) as { price?: string };
      const price = Number(data.price);
      if (Number.isFinite(price) && price > 0) {
        return { priceUsd: price, source: `binance:${symbol}` };
      }
    } catch (e) {
      console.warn(`[billingPrices] Binance ${symbol} failed`, e);
    }
  }

  const matic = await fetchBinanceSymbolPriceUsd('MATICUSDT');
  if (matic) return { priceUsd: matic, source: 'binance:MATICUSDT' };

  return { priceUsd: 0.25, source: 'fail-safe:pol-fallback' };
}

export async function getBillingPricesSnapshot(options?: {
  revalidateSeconds?: number;
  fresh?: boolean;
}): Promise<BillingPricesSnapshot> {
  const [polMarket, bfaxMarket] = await Promise.all([
    fetchPolPriceUsd({ fresh: options?.fresh }),
    fetchMarketBfaxPriceUsd({
      revalidateSeconds: options?.revalidateSeconds ?? 10,
      fresh: options?.fresh,
    }),
  ]);

  const bfaxEffective = applyBfaxPriceFloor(bfaxMarket.priceUsd);
  const bfaxFloorActive = bfaxMarket.priceUsd < BFAX_PRICE_FLOOR_USD;

  return {
    pol: {
      marketPriceUsd: polMarket.priceUsd,
      effectivePriceUsd: polMarket.priceUsd,
      source: polMarket.source,
    },
    bfax: {
      marketPriceUsd: bfaxMarket.priceUsd,
      effectivePriceUsd: bfaxEffective,
      priceFloorUsd: BFAX_PRICE_FLOOR_USD,
      source: bfaxFloorActive
        ? `${bfaxMarket.source} (price-floor-guard-active)`
        : bfaxMarket.source,
    },
    usdt: {
      marketPriceUsd: STABLECOIN_USD_PRICE,
      effectivePriceUsd: STABLECOIN_USD_PRICE,
      source: 'peg:usd-stablecoin',
    },
    usdc: {
      marketPriceUsd: STABLECOIN_USD_PRICE,
      effectivePriceUsd: STABLECOIN_USD_PRICE,
      source: 'peg:usd-stablecoin',
    },
    updatedAt: new Date().toISOString(),
  };
}
