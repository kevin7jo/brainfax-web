import { createPublicClient, formatEther, http, parseEther } from 'viem';
import { polygonMainnet } from './polygonChain';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildBalanceUpsert, fetchUserBalanceRow, insertRechargeLedger, readBfaxAmount } from './adminDb';

export function getTreasuryAddress(): string {
  const addr = process.env.NEXT_PUBLIC_TREASURY_ADDRESS?.trim();
  if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr)) {
    throw new Error('NEXT_PUBLIC_TREASURY_ADDRESS가 유효하지 않습니다.');
  }
  return addr;
}

export function getBfaxPerPol(): number {
  const raw = process.env.CRYPTO_BFAX_PER_POL ?? process.env.NEXT_PUBLIC_BFAX_PER_POL ?? '100';
  const rate = Number(raw);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('CRYPTO_BFAX_PER_POL 환경 변수가 유효하지 않습니다.');
  }
  return rate;
}

export function polToBfax(polAmount: string | number): number {
  const pol = typeof polAmount === 'string' ? Number(polAmount) : polAmount;
  if (!Number.isFinite(pol) || pol <= 0) return 0;
  return Math.floor(pol * getBfaxPerPol());
}

export function getPolygonPublicClient() {
  const rpc =
    process.env.POLYGON_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_POLYGON_RPC_URL?.trim() ||
    polygonMainnet.rpcUrls.default.http[0];

  return createPublicClient({
    chain: polygonMainnet,
    transport: http(rpc),
  });
}

export type VerifyPolResult = {
  from: string;
  to: string;
  valueWei: bigint;
  blockNumber: bigint;
};

/** 폴리곤 메인넷 POL 네이티브 전송 무결성 검증 */
export async function verifyPolygonPolDeposit(params: {
  txHash: `0x${string}`;
  treasuryAddress: string;
  fromAddress: string;
  expectedPolWei: bigint;
}): Promise<VerifyPolResult> {
  const client = getPolygonPublicClient();
  const treasury = params.treasuryAddress.toLowerCase();
  const from = params.fromAddress.toLowerCase();

  const [tx, receipt] = await Promise.all([
    client.getTransaction({ hash: params.txHash }),
    client.getTransactionReceipt({ hash: params.txHash }),
  ]);

  if (!tx) {
    throw new Error('트랜잭션을 찾을 수 없습니다. 잠시 후 다시 시도하세요.');
  }
  if (!receipt || receipt.status !== 'success') {
    throw new Error('트랜잭션이 성공 상태가 아닙니다.');
  }
  if (!tx.to || tx.to.toLowerCase() !== treasury) {
    throw new Error('수신 주소가 회사 트레저리 지갑과 일치하지 않습니다.');
  }
  if (!tx.from || tx.from.toLowerCase() !== from) {
    throw new Error('송금 지갑 주소가 연결된 지갑과 일치하지 않습니다.');
  }
  if (tx.value < params.expectedPolWei) {
    throw new Error(
      `입금 POL이 부족합니다. 기대: ${formatEther(params.expectedPolWei)} POL, 실제: ${formatEther(tx.value)} POL`
    );
  }

  return {
    from: tx.from,
    to: tx.to,
    valueWei: tx.value,
    blockNumber: receipt.blockNumber,
  };
}

export async function findCryptoRechargeByTxHash(
  db: SupabaseClient,
  txHash: string
): Promise<boolean> {
  const needle = txHash.toLowerCase();
  const { data, error } = await db
    .from('lb_recharge_history')
    .select('id')
    .eq('status', 'CRYPTO_RECHARGE')
    .ilike('note', `%${needle}%`)
    .limit(1);

  if (error) {
    if (error.code === '42P01') return false;
    throw new Error(error.message);
  }
  return (data?.length ?? 0) > 0;
}

export async function creditCryptoRecharge(params: {
  db: SupabaseClient;
  customerEmail: string;
  txHash: string;
  polWei: bigint;
  walletAddress: string;
}): Promise<{ bfaxCredited: number; balanceAfter: number; polAmount: string }> {
  const polHuman = formatEther(params.polWei);
  const bfaxCredited = polToBfax(Number(polHuman));

  if (bfaxCredited <= 0) {
    throw new Error('충전할 BFAX 수량이 0입니다. POL 입금액을 확인하세요.');
  }

  const { data: current, error: fetchError } = await fetchUserBalanceRow(params.db, params.customerEmail);
  if (fetchError) throw new Error(fetchError);

  const currentAmount = readBfaxAmount(current);
  const balanceAfter = currentAmount + bfaxCredited;

  const { error: balanceError } = await params.db
    .from('lb_user_balance')
    .upsert(buildBalanceUpsert(params.customerEmail, balanceAfter, current?.account_status as string | undefined), {
      onConflict: 'customer_email',
    });
  if (balanceError) throw new Error(balanceError.message);

  const note = `POL ${polHuman} | tx:${params.txHash} | wallet:${params.walletAddress}`;

  const ledger = await insertRechargeLedger(params.db, {
    customer_email: params.customerEmail,
    bfax_delta: bfaxCredited,
    balance_after: balanceAfter,
    status: 'CRYPTO_RECHARGE',
    note,
    admin_email: params.walletAddress,
  });

  if (!ledger.ok) {
    throw new Error(ledger.error ?? '장부 기록에 실패했습니다.');
  }

  return { bfaxCredited, balanceAfter, polAmount: polHuman };
}

export function parsePolToWei(polAmount: string): bigint {
  const trimmed = polAmount.trim();
  if (!trimmed || !/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error('유효한 POL 수량이 아닙니다.');
  }
  return parseEther(trimmed);
}
