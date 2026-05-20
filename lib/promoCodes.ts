/** 등록된 프로모션 코드 (대문자 키) */
export const PROMO_CODES: Record<string, { bfax: number; description?: string }> = {
  DEEPTECH10: { bfax: 10, description: 'Deep Tech launch bonus' },
};

export function resolvePromoCode(raw: string): { code: string; bfax: number } | null {
  const code = raw.trim().toUpperCase();
  const entry = PROMO_CODES[code];
  if (!entry || entry.bfax <= 0) return null;
  return { code, bfax: entry.bfax };
}

export function promoActivityLabel(code: string): string {
  return `Promo: ${code}`;
}
