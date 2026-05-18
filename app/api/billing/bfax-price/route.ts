import { NextResponse } from 'next/server';
import { getBfaxOracleSnapshot } from '../../../../lib/bfaxOracle';

/** 실시간 BFAX/USD 오라클 피드 (QuickSwap 연동 뼈대 + mock $1.00) */
export async function GET() {
  try {
    const snapshot = await getBfaxOracleSnapshot();
    return NextResponse.json({
      ok: true,
      ...snapshot,
      /** UI 표시용: 1 BFAX = $X */
      bfaxUsd: snapshot.effectivePriceUsd,
    });
  } catch (e) {
    console.error('bfax-price', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '오라클 가격 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}
