import { NextResponse } from 'next/server';
import { createServiceClient } from '../../../../lib/supabaseAdmin';
import {
  BFAX_TOKEN_PAYMENT_BONUS_PERCENT,
  PACKAGE_VOLUME_BONUS_PERCENT,
  computeSaaSCreditsForPackage,
  computeVariableBfaxTokenCharge,
  getBfaxOracleSnapshot,
  getRechargePackage,
  isPackageId,
  type PackageId,
} from '../../../../lib/bfaxOracle';
import {
  creditBfaxTokenRecharge,
  creditCryptoRecharge,
  findCryptoRechargeByTxHash,
  getBfaxContractAddress,
  getTreasuryAddress,
  isPaymentMethod,
  parsePolToWei,
  verifyPolygonBfaxTokenDeposit,
  verifyPolygonPolDeposit,
} from '../../../../lib/cryptoBilling';
import type { PaymentMethod } from '../../../../lib/cryptoPayment';
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
  const paymentMethodRaw = String(body?.paymentMethod ?? 'POL').trim().toUpperCase();
  const packageIdRaw = String(body?.packageId ?? '').trim();

  if (!isPaymentMethod(paymentMethodRaw)) {
    return NextResponse.json(
      { error: "paymentMethod는 'POL' 또는 'BFAX'여야 합니다." },
      { status: 400 }
    );
  }

  const paymentMethod: PaymentMethod = paymentMethodRaw;

  if (!txHashRaw || !/^0x[a-fA-F0-9]{64}$/.test(txHashRaw)) {
    return NextResponse.json({ error: '유효한 txHash가 필요합니다.' }, { status: 400 });
  }
  if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return NextResponse.json({ error: '유효한 walletAddress가 필요합니다.' }, { status: 400 });
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

    if (paymentMethod === 'POL') {
      if (!isPackageId(packageIdRaw)) {
        return NextResponse.json({ error: '유효한 packageId가 필요합니다.' }, { status: 400 });
      }
      const packageId = packageIdRaw as PackageId;
      const pkg = getRechargePackage(packageId);
      const polAmount = String(body?.polAmount ?? pkg.polAmount).trim();

      let expectedPolWei: bigint;
      try {
        expectedPolWei = parsePolToWei(polAmount);
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : 'POL 수량 형식 오류' },
          { status: 400 }
        );
      }

      const verified = await verifyPolygonPolDeposit({
        txHash,
        treasuryAddress: treasury,
        fromAddress: walletAddress,
        expectedPolWei,
      });

      const bfaxCredited = computeSaaSCreditsForPackage(packageId, 'POL');
      const volPct = PACKAGE_VOLUME_BONUS_PERCENT[packageId];
      const volNote = volPct > 0 ? ` | +${volPct}% vol bonus` : '';

      const result = await creditCryptoRecharge({
        db,
        customerEmail: auth.email,
        txHash,
        polWei: verified.valueWei,
        walletAddress,
        bfaxCreditedOverride: bfaxCredited,
        ledgerNoteExtra: ` | pkg:${packageId} | queue:+${bfaxCredited}${volNote}`,
      });

      return NextResponse.json({
        ok: true,
        paymentMethod: 'POL',
        packageId,
        packageUsd: pkg.usdValue,
        txHash,
        polAmount: result.polAmount,
        bfaxCredited: result.bfaxCredited,
        balanceAfter: result.balanceAfter,
        blockNumber: verified.blockNumber.toString(),
      });
    }

    if (!isPackageId(packageIdRaw)) {
      return NextResponse.json({ error: '유효한 packageId가 필요합니다.' }, { status: 400 });
    }
    const packageId = packageIdRaw as PackageId;
    const pkg = getRechargePackage(packageId);

    let bfaxContract: string;
    try {
      bfaxContract = getBfaxContractAddress();
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'BFAX 컨트랙트 주소 미설정' },
        { status: 500 }
      );
    }

    const oracle = await getBfaxOracleSnapshot({ fresh: true });
    const { tokenAmountHuman, tokenAmountWei, tokenDecimals } = computeVariableBfaxTokenCharge({
      packageUsd: pkg.usdValue,
      effectivePriceUsd: oracle.effectivePriceUsd,
    });

    const verified = await verifyPolygonBfaxTokenDeposit({
      txHash,
      treasuryAddress: treasury,
      fromAddress: walletAddress,
      bfaxContractAddress: bfaxContract,
      expectedTokenWei: tokenAmountWei,
    });

    const bfaxCredited = computeSaaSCreditsForPackage(packageId, 'BFAX');
    const volPct = PACKAGE_VOLUME_BONUS_PERCENT[packageId];
    const ledgerNoteExtra = ` | pkg:${packageId} $${pkg.usdValue} | oracle:$${oracle.effectivePriceUsd} (mkt:$${oracle.marketPriceUsd}) | +${volPct}% vol +${BFAX_TOKEN_PAYMENT_BONUS_PERCENT}% token`;

    const result = await creditBfaxTokenRecharge({
      db,
      customerEmail: auth.email,
      txHash,
      tokenWei: verified.valueWei,
      walletAddress,
      decimals: verified.decimals,
      bfaxCreditedOverride: bfaxCredited,
      ledgerNoteExtra,
    });

    return NextResponse.json({
      ok: true,
      paymentMethod: 'BFAX',
      packageId,
      packageUsd: pkg.usdValue,
      txHash,
      bfaxAmount: result.tokenAmount,
      bfaxAmountRequired: tokenAmountHuman,
      oracle: {
        marketPriceUsd: oracle.marketPriceUsd,
        effectivePriceUsd: oracle.effectivePriceUsd,
        priceFloorUsd: oracle.priceFloorUsd,
      },
      bfaxCredited: result.bfaxCredited,
      bonusPercent: 10,
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
