import { NextResponse } from 'next/server';
import { getBfaxOracleSnapshot } from '../../../../lib/bfaxOracle';

/** Dexscreener 실시간 BFAX/USD 오라클 (10초 캐시 + $0.10 price floor) */
export async function GET() {
  try {
    const snapshot = await getBfaxOracleSnapshot({ revalidateSeconds: 10 });

    return NextResponse.json({
      success: true,
      ok: true,
      priceUsd: snapshot.effectivePriceUsd,
      marketPrice: snapshot.marketPriceUsd,
      marketPriceUsd: snapshot.marketPriceUsd,
      effectivePriceUsd: snapshot.effectivePriceUsd,
      priceFloorUsd: snapshot.priceFloorUsd,
      feed: snapshot.source,
      source: snapshot.source,
      timestamp: snapshot.updatedAt,
      updatedAt: snapshot.updatedAt,
      bfaxUsd: snapshot.effectivePriceUsd,
    });
  } catch (e) {
    console.error('Dex Oracle failed, fail-safe activated', e);
    return NextResponse.json({
      success: true,
      ok: true,
      priceUsd: 0.1,
      marketPrice: 0,
      marketPriceUsd: 0,
      effectivePriceUsd: 0.1,
      priceFloorUsd: 0.1,
      feed: 'fail-safe:backup-oracle',
      source: 'fail-safe:backup-oracle',
      timestamp: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      bfaxUsd: 0.1,
    });
  }
}
