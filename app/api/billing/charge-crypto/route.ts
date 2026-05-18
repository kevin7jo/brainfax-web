import { NextResponse } from 'next/server';
import { createServiceClient } from '../../../../lib/supabaseAdmin';
import {
  creditCryptoRecharge,
  findCryptoRechargeByTxHash,
  getTreasuryAddress,
  parsePolToWei,
  verifyPolygonPolDeposit,
} from '../../../../lib/cryptoBilling';
import { verifyUserRequest } from '../../../../lib/verifyUserRequest';

export async function POST(request: Request) {
  const auth = await verifyUserRequest(request);
  if (auth.ok === false) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const db = createServiceClient();
  if (!db) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.' },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const txHashRaw = String(body?.txHash ?? '').trim();
  const walletAddress = String(body?.walletAddress ?? '').trim();
  const polAmount = String(body?.polAmount ?? '').trim();

  if (!txHashRaw || !/^0x[a-fA-F0-9]{64}$/.test(txHashRaw)) {
    return NextResponse.json({ error: '유효한 txHash가 필요합니다.' }, { status: 400 });
  }
  if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return NextResponse.json({ error: '유효한 walletAddress가 필요합니다.' }, { status: 400 });
  }
  if (!polAmount) {
    return NextResponse.json({ error: 'polAmount가 필요합니다.' }, { status: 400 });
  }

  let expectedPolWei: bigint;
  try {
    expectedPolWei = parsePolToWei(polAmount);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'POL 수량 형식 오류' },
      { status: 400 }
    );
  }

  let treasury: string;
  try {
    treasury = getTreasuryAddress();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '트레저리 주소 미설정' },
      { status: 500 }
    );
  }

  const txHash = txHashRaw as `0x${string}`;

  try {
    const alreadyUsed = await findCryptoRechargeByTxHash(db, txHash);
    if (alreadyUsed) {
      return NextResponse.json({ error: '이미 처리된 트랜잭션입니다.' }, { status: 409 });
    }

    const verified = await verifyPolygonPolDeposit({
      txHash,
      treasuryAddress: treasury,
      fromAddress: walletAddress,
      expectedPolWei,
    });

    const result = await creditCryptoRecharge({
      db,
      customerEmail: auth.email,
      txHash,
      polWei: verified.valueWei,
      walletAddress,
    });

    return NextResponse.json({
      ok: true,
      txHash,
      polAmount: result.polAmount,
      bfaxCredited: result.bfaxCredited,
      balanceAfter: result.balanceAfter,
      blockNumber: verified.blockNumber.toString(),
    });
  } catch (e) {
    console.error('charge-crypto', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '암호화폐 충전 검증에 실패했습니다.' },
      { status: 400 }
    );
  }
}
