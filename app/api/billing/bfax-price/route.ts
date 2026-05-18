import { NextResponse } from 'next/server';
import { getBillingPricesSnapshot } from '../../../../lib/billingPrices';

/** @deprecated — `/api/billing/prices` BFAX 슬라이스 (하위 호환) */
export async function GET() {
  try {
    const snapshot = await getBillingPricesSnapshot({ revalidateSeconds: 10 });
    const bfax = snapshot.bfax;

    return NextResponse.json({
      success: true,
      ok: true,
      priceUsd: bfax.effectivePriceUsd,
      marketPrice: bfax.marketPriceUsd,
      marketPriceUsd: bfax.marketPriceUsd,
      effectivePriceUsd: bfax.effectivePriceUsd,
      priceFloorUsd: bfax.priceFloorUsd,
      feed: bfax.source,
      source: bfax.source,
      timestamp: snapshot.updatedAt,
      updatedAt: snapshot.updatedAt,
      bfaxUsd: bfax.effectivePriceUsd,
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
