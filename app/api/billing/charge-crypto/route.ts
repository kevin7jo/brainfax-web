import { NextResponse } from 'next/server';
import { createServiceClient } from '../../../../lib/supabaseAdmin';
import {
  BFAX_TOKEN_PAYMENT_BONUS_PERCENT,
  PACKAGE_VOLUME_BONUS_PERCENT,
  computeSaaSCreditsForPackage,
  getRechargePackage,
  isPackageId,
  type PackageId,
} from '../../../../lib/bfaxOracle';
import { getBillingPricesSnapshot } from '../../../../lib/billingPrices';
import { computePackagePaymentQuote } from '../../../../lib/billingQuotes';
import {
  creditCryptoRecharge,
  creditErc20TokenRecharge,
  findCryptoRechargeByTxHash,
  getErc20ContractForPayment,
  getTreasuryAddress,
  verifyPolygonErc20TokenDeposit,
  verifyPolygonPolDeposit,
} from '../../../../lib/cryptoBilling';
import { isErc20PaymentMethod, isPaymentMethod, type PaymentMethod } from '../../../../lib/cryptoPayment';
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
      { error: "paymentMethod는 'POL' | 'BFAX' | 'USDT' | 'USDC' 여야 합니다." },
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
  if (!isPackageId(packageIdRaw)) {
    return NextResponse.json({ error: '유효한 packageId가 필요합니다.' }, { status: 400 });
  }

  const packageId = packageIdRaw as PackageId;
  const pkg = getRechargePackage(packageId);

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

    const prices = await getBillingPricesSnapshot({ fresh: true });
    const quote = computePackagePaymentQuote({
      packageId,
      paymentMethod,
      prices,
    });

    const bfaxCredited = computeSaaSCreditsForPackage(packageId, paymentMethod);
    const volPct = PACKAGE_VOLUME_BONUS_PERCENT[packageId];

    if (paymentMethod === 'POL') {
      const verified = await verifyPolygonPolDeposit({
        txHash,
        treasuryAddress: treasury,
        fromAddress: walletAddress,
        expectedPolWei: quote.amountWei,
      });

      const volNote = volPct > 0 ? ` | +${volPct}% vol` : '';
      const result = await creditCryptoRecharge({
        db,
        customerEmail: auth.email,
        txHash,
        polWei: verified.valueWei,
        walletAddress,
        bfaxCreditedOverride: bfaxCredited,
        ledgerNoteExtra: ` | pkg:${packageId} $${pkg.usdValue} | oracle POL $${quote.unitPriceUsd}${volNote}`,
      });

      return NextResponse.json({
        ok: true,
        paymentMethod: 'POL',
        packageId,
        packageUsd: pkg.usdValue,
        txHash,
        polAmount: result.polAmount,
        amountRequired: quote.amountHuman,
        oracleUnitUsd: quote.unitPriceUsd,
        bfaxCredited: result.bfaxCredited,
        balanceAfter: result.balanceAfter,
        blockNumber: verified.blockNumber.toString(),
      });
    }

    if (!isErc20PaymentMethod(paymentMethod)) {
      return NextResponse.json({ error: '지원하지 않는 결제 수단입니다.' }, { status: 400 });
    }

    let tokenContract: string;
    try {
      tokenContract = getErc20ContractForPayment(paymentMethod);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : '토큰 컨트랙트 주소 미설정' },
        { status: 500 }
      );
    }

    const verified = await verifyPolygonErc20TokenDeposit({
      txHash,
      treasuryAddress: treasury,
      fromAddress: walletAddress,
      tokenContractAddress: tokenContract,
      expectedTokenWei: quote.amountWei,
      tokenSymbol: paymentMethod,
    });

    const bonusNote =
      paymentMethod === 'BFAX'
        ? ` | +${volPct}% vol +${BFAX_TOKEN_PAYMENT_BONUS_PERCENT}% web3`
        : volPct > 0
          ? ` | +${volPct}% vol`
          : '';

    const ledgerNoteExtra = ` | pkg:${packageId} $${pkg.usdValue} | oracle $${quote.unitPriceUsd}${bonusNote}`;

    const result = await creditErc20TokenRecharge({
      db,
      customerEmail: auth.email,
      txHash,
      tokenWei: verified.valueWei,
      walletAddress,
      decimals: verified.decimals,
      paymentMethod,
      bfaxCreditedOverride: bfaxCredited,
      ledgerNoteExtra,
    });

    return NextResponse.json({
      ok: true,
      paymentMethod,
      packageId,
      packageUsd: pkg.usdValue,
      txHash,
      tokenAmount: result.tokenAmount,
      amountRequired: quote.amountHuman,
      oracleUnitUsd: quote.unitPriceUsd,
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
