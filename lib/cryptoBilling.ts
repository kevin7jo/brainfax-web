import {
  createPublicClient,
  decodeEventLog,
  erc20Abi,
  formatEther,
  formatUnits,
  http,
  parseEther,
  parseUnits,
} from 'viem';
import { polygonMainnet } from './polygonChain';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildBalanceUpsert, fetchUserBalanceRow, insertRechargeLedger, readBfaxAmount } from './adminDb';
import {
  CRYPTO_LEDGER_STATUS,
  ERC20_TRANSFER_TOPIC,
  isErc20PaymentMethod,
  type PaymentMethod,
} from './cryptoPayment';
import { computePackagePaymentQuote } from './billingQuotes';
import { getBillingPricesSnapshot } from './billingPrices';
import type { PackageId } from './bfaxOracle';

export function getTreasuryAddress(): string {
  const addr = process.env.NEXT_PUBLIC_TREASURY_ADDRESS?.trim();
  if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr)) {
    throw new Error('NEXT_PUBLIC_TREASURY_ADDRESS가 유효하지 않습니다.');
  }
  return addr;
}

export function getBfaxContractAddress(): string {
  const addr = process.env.NEXT_PUBLIC_BFAX_CONTRACT_ADDRESS?.trim();
  if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr)) {
    throw new Error('NEXT_PUBLIC_BFAX_CONTRACT_ADDRESS가 유효하지 않습니다.');
  }
  return addr;
}

export function getUsdtContractAddress(): string {
  const addr = process.env.NEXT_PUBLIC_USDT_CONTRACT_ADDRESS?.trim();
  if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr)) {
    throw new Error('NEXT_PUBLIC_USDT_CONTRACT_ADDRESS가 유효하지 않습니다.');
  }
  return addr;
}

export function getUsdcContractAddress(): string {
  const addr = process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS?.trim();
  if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr)) {
    throw new Error('NEXT_PUBLIC_USDC_CONTRACT_ADDRESS가 유효하지 않습니다.');
  }
  return addr;
}

export function getErc20ContractForPayment(method: PaymentMethod): string {
  switch (method) {
    case 'BFAX':
      return getBfaxContractAddress();
    case 'USDT':
      return getUsdtContractAddress();
    case 'USDC':
      return getUsdcContractAddress();
    default:
      throw new Error(`${method}는 ERC-20 결제가 아닙니다.`);
  }
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

export type VerifyBfaxTokenResult = {
  from: string;
  to: string;
  valueWei: bigint;
  blockNumber: bigint;
  contractAddress: string;
  decimals: number;
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

/** Polygon ERC-20 Transfer 로그 무결성 검증 (BFAX / USDT / USDC) */
export async function verifyPolygonErc20TokenDeposit(params: {
  txHash: `0x${string}`;
  treasuryAddress: string;
  fromAddress: string;
  tokenContractAddress: string;
  expectedTokenWei: bigint;
  tokenSymbol?: string;
}): Promise<VerifyBfaxTokenResult> {
  const client = getPolygonPublicClient();
  const treasury = params.treasuryAddress.toLowerCase();
  const from = params.fromAddress.toLowerCase();
  const contract = params.tokenContractAddress.toLowerCase();
  const symbol = params.tokenSymbol ?? 'TOKEN';

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
  if (!tx.from || tx.from.toLowerCase() !== from) {
    throw new Error('송금 지갑 주소가 연결된 지갑과 일치하지 않습니다.');
  }

  let decimals = 18;
  try {
    const onChainDecimals = await client.readContract({
      address: contract as `0x${string}`,
      abi: erc20Abi,
      functionName: 'decimals',
    });
    decimals = Number(onChainDecimals);
    if (!Number.isFinite(decimals) || decimals < 0 || decimals > 36) decimals = 18;
  } catch {
    decimals = 18;
  }

  let matchedValue: bigint | null = null;

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== contract) continue;
    if (log.topics[0]?.toLowerCase() !== ERC20_TRANSFER_TOPIC) continue;

    try {
      const decoded = decodeEventLog({
        abi: erc20Abi,
        eventName: 'Transfer',
        data: log.data,
        topics: log.topics,
      });

      const toAddr = String(decoded.args.to).toLowerCase();
      const fromAddr = String(decoded.args.from).toLowerCase();
      const value = decoded.args.value as bigint;

      if (fromAddr !== from || toAddr !== treasury) continue;
      if (value === params.expectedTokenWei) {
        matchedValue = value;
        break;
      }
    } catch {
      continue;
    }
  }

  if (matchedValue === null) {
    throw new Error(
      `${symbol} 입금 수량이 오라클 정산액과 일치하지 않습니다. 필요: ${formatUnits(params.expectedTokenWei, decimals)} ${symbol} (소수 ${decimals}자리 정밀 일치)`
    );
  }

  return {
    from: tx.from,
    to: treasury,
    valueWei: matchedValue,
    blockNumber: receipt.blockNumber,
    contractAddress: contract,
    decimals,
  };
}

/** @deprecated verifyPolygonErc20TokenDeposit 사용 */
export async function verifyPolygonBfaxTokenDeposit(params: {
  txHash: `0x${string}`;
  treasuryAddress: string;
  fromAddress: string;
  bfaxContractAddress: string;
  expectedTokenWei: bigint;
}): Promise<VerifyBfaxTokenResult> {
  return verifyPolygonErc20TokenDeposit({
    ...params,
    tokenContractAddress: params.bfaxContractAddress,
    tokenSymbol: 'BFAX',
  });
}

export async function findCryptoRechargeByTxHash(
  db: SupabaseClient,
  txHash: string
): Promise<boolean> {
  const needle = txHash.toLowerCase();
  const { data, error } = await db
    .from('lb_recharge_history')
    .select('id')
    .in('status', Object.values(CRYPTO_LEDGER_STATUS))
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
  /** 패키지 볼륨 보너스 반영 Queue (미지정 시 POL×환율) */
  bfaxCreditedOverride?: number;
  ledgerNoteExtra?: string;
}): Promise<{ bfaxCredited: number; balanceAfter: number; polAmount: string }> {
  const polHuman = formatEther(params.polWei);
  const bfaxCredited =
    params.bfaxCreditedOverride !== undefined
      ? params.bfaxCreditedOverride
      : polToBfax(Number(polHuman));

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

  const note = `POL ${polHuman}${params.ledgerNoteExtra ?? ''} | tx:${params.txHash} | wallet:${params.walletAddress}`;

  const ledger = await insertRechargeLedger(params.db, {
    customer_email: params.customerEmail,
    bfax_delta: bfaxCredited,
    balance_after: balanceAfter,
    status: CRYPTO_LEDGER_STATUS.POL,
    note,
    admin_email: params.walletAddress,
  });

  if (!ledger.ok) {
    throw new Error(ledger.error ?? '장부 기록에 실패했습니다.');
  }

  return { bfaxCredited, balanceAfter, polAmount: polHuman };
}

export async function creditErc20TokenRecharge(params: {
  db: SupabaseClient;
  customerEmail: string;
  txHash: string;
  tokenWei: bigint;
  walletAddress: string;
  decimals: number;
  paymentMethod: PaymentMethod;
  bfaxCreditedOverride?: number;
  ledgerNoteExtra?: string;
}): Promise<{ bfaxCredited: number; balanceAfter: number; tokenAmount: string }> {
  if (!isErc20PaymentMethod(params.paymentMethod)) {
    throw new Error('ERC-20 충전이 아닌 결제 수단입니다.');
  }

  const tokenHuman = formatUnits(params.tokenWei, params.decimals);
  const bfaxCredited =
    params.bfaxCreditedOverride !== undefined
      ? params.bfaxCreditedOverride
      : Math.floor(Number(tokenHuman));

  if (bfaxCredited <= 0) {
    throw new Error('충전할 Queue가 0입니다. 토큰 입금액을 확인하세요.');
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

  const note = `${params.paymentMethod} ${tokenHuman} | tx:${params.txHash} | wallet:${params.walletAddress}${params.ledgerNoteExtra ?? ''}`;

  const ledger = await insertRechargeLedger(params.db, {
    customer_email: params.customerEmail,
    bfax_delta: bfaxCredited,
    balance_after: balanceAfter,
    status: CRYPTO_LEDGER_STATUS[params.paymentMethod],
    note,
    admin_email: params.walletAddress,
  });

  if (!ledger.ok) {
    throw new Error(ledger.error ?? '장부 기록에 실패했습니다.');
  }

  return { bfaxCredited, balanceAfter, tokenAmount: tokenHuman };
}

/** @deprecated creditErc20TokenRecharge 사용 */
export async function creditBfaxTokenRecharge(params: {
  db: SupabaseClient;
  customerEmail: string;
  txHash: string;
  tokenWei: bigint;
  walletAddress: string;
  decimals: number;
  bfaxCreditedOverride?: number;
  ledgerNoteExtra?: string;
}): Promise<{ bfaxCredited: number; balanceAfter: number; tokenAmount: string }> {
  return creditErc20TokenRecharge({ ...params, paymentMethod: 'BFAX' });
}

export async function settlePackagePaymentOnServer(params: {
  packageId: PackageId;
  paymentMethod: PaymentMethod;
  freshOracle?: boolean;
}) {
  const prices = await getBillingPricesSnapshot({ fresh: params.freshOracle ?? true });
  return computePackagePaymentQuote({
    packageId: params.packageId,
    paymentMethod: params.paymentMethod,
    prices,
  });
}

export function parsePolToWei(polAmount: string): bigint {
  const trimmed = polAmount.trim();
  if (!trimmed || !/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error('유효한 POL 수량이 아닙니다.');
  }
  return parseEther(trimmed);
}

export function parseBfaxTokenAmount(amount: string, decimals = 18): bigint {
  const trimmed = amount.trim();
  if (!trimmed || !/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error('유효한 BFAX 토큰 수량이 아닙니다.');
  }
  return parseUnits(trimmed, decimals);
}

export { isPaymentMethod } from './cryptoPayment';
