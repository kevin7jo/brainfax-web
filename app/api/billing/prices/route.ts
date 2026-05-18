import { NextResponse } from 'next/server';
import { BFAX_PRICE_FLOOR_USD } from '../../../../lib/bfaxOracle';
import { getBillingPricesSnapshot } from '../../../../lib/billingPrices';

/** 옴니체인 실시간 오라클 — POL · BFAX(하한 $0.10) · USDT/USDC($1.00) */
export async function GET() {
  try {
    const snapshot = await getBillingPricesSnapshot({ revalidateSeconds: 10 });

    return NextResponse.json({
      ok: true,
      success: true,
      updatedAt: snapshot.updatedAt,
      pol: {
        marketPriceUsd: snapshot.pol.marketPriceUsd,
        effectivePriceUsd: snapshot.pol.effectivePriceUsd,
        source: snapshot.pol.source,
      },
      bfax: {
        marketPriceUsd: snapshot.bfax.marketPriceUsd,
        effectivePriceUsd: snapshot.bfax.effectivePriceUsd,
        priceFloorUsd: snapshot.bfax.priceFloorUsd,
        source: snapshot.bfax.source,
        /** 레거시 호환 */
        priceUsd: snapshot.bfax.effectivePriceUsd,
      },
      usdt: {
        marketPriceUsd: snapshot.usdt.marketPriceUsd,
        effectivePriceUsd: snapshot.usdt.effectivePriceUsd,
        source: snapshot.usdt.source,
      },
      usdc: {
        marketPriceUsd: snapshot.usdc.marketPriceUsd,
        effectivePriceUsd: snapshot.usdc.effectivePriceUsd,
        source: snapshot.usdc.source,
      },
      priceFloorUsd: BFAX_PRICE_FLOOR_USD,
    });
  } catch (e) {
    console.error('[billing/prices]', e);
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : '오라클 조회 실패',
      },
      { status: 500 }
    );
  }
}
