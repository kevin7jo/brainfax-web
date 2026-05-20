/** BrainFax 옴니채널 헬프데스크 수신 주소 (고객 문의 mailto) */
export const BFAX_SUPPORT_EMAIL = 'bfax.help@brainfax.net';

export function getBfaxSupportMailtoHref(): string {
  return `mailto:${BFAX_SUPPORT_EMAIL}`;
}
