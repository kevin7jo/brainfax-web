/** 온체인 ERC-20 공식 명칭 */
export const BFAX_TOKEN_LABEL = 'BFAX Token';

/** SaaS AI 에이전트 연료(내부 크레딧) 공식 명칭 */
export const BFAX_QUEUE_LABEL = 'BFAX Queue';

export function formatBfaxQueue(
  amount: number,
  options?: { bonus?: boolean; locale?: boolean }
): string {
  const n = options?.locale === false ? String(amount) : amount.toLocaleString();
  const base = `${n} ${BFAX_QUEUE_LABEL}`;
  return options?.bonus ? `${base} (+10% Bonus)` : base;
}

export function formatBfaxToken(amount: string | number): string {
  return `${amount} ${BFAX_TOKEN_LABEL}`;
}

export function formatPolToQueueRate(bfaxPerPol: number): string {
  return `1 POL = ${bfaxPerPol} ${BFAX_QUEUE_LABEL}`;
}
