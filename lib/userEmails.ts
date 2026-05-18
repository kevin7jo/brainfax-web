import { timingSafeEqual } from 'crypto';
import { OTP_LENGTH, OTP_TTL_MINUTES } from './userEmailsConstants';

export { OTP_LENGTH, OTP_TTL_MINUTES } from './userEmailsConstants';

export type UserEmailRow = {
  id: string;
  user_id: string;
  email: string;
  is_verified: boolean;
  verification_code: string | null;
  code_expires_at: string | null;
  created_at: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(raw: string): boolean {
  const email = normalizeEmail(raw);
  return email.length <= 254 && EMAIL_RE.test(email);
}

/** 암호학적으로 안전한 6자리 OTP */
export function generateEmailOtp(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000;
  return String(n).padStart(OTP_LENGTH, '0');
}

export function getOtpExpiresAt(from = new Date()): string {
  return new Date(from.getTime() + OTP_TTL_MINUTES * 60 * 1000).toISOString();
}

export function isOtpExpired(expiresAt: string | null | undefined, now = new Date()): boolean {
  if (!expiresAt) return true;
  const exp = new Date(expiresAt);
  return Number.isNaN(exp.getTime()) || exp.getTime() <= now.getTime();
}

/** 타이밍 공격 방어 코드 비교 */
export function safeOtpCompare(provided: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const a = provided.trim().padStart(OTP_LENGTH, '0');
  const b = stored.trim().padStart(OTP_LENGTH, '0');
  if (a.length !== b.length || a.length !== OTP_LENGTH) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/**
 * OTP 인증 메일 발송 스켈레톤.
 *
 * 프로덕션 전환 가이드:
 * 1) Resend (권장): `npm i resend` 후 RESEND_API_KEY 설정
 *    ```ts
 *    import { Resend } from 'resend';
 *    const resend = new Resend(process.env.RESEND_API_KEY);
 *    await resend.emails.send({
 *      from: 'BrainFax <verify@yourdomain.com>',
 *      to: params.to,
 *      subject: 'BrainFax 이메일 연동 인증 코드',
 *      html: `<p>인증 코드: <strong>${params.code}</strong> (${OTP_TTL_MINUTES}분 내 입력)</p>`,
 *    });
 *    ```
 * 2) Nodemailer + SMTP: `npm i nodemailer` 후 SMTP_* 환경 변수
 *    ```ts
 *    import nodemailer from 'nodemailer';
 *    const transport = nodemailer.createTransport({ host, port, auth: { user, pass } });
 *    await transport.sendMail({ from, to: params.to, subject, text: `코드: ${params.code}` });
 *    ```
 */
export async function sendVerificationEmail(params: {
  to: string;
  code: string;
  expiresMinutes?: number;
}): Promise<{ sent: boolean; provider: 'stub' | 'resend' | 'nodemailer' }> {
  const expiresMinutes = params.expiresMinutes ?? OTP_TTL_MINUTES;

  // TODO: RESEND_API_KEY 또는 SMTP 설정 시 위 가이드대로 실제 발송으로 교체
  if (process.env.NODE_ENV === 'development') {
    console.info(
      `[BFAX Email Factory] OTP → ${params.to} | code=${params.code} | expires in ${expiresMinutes}m`
    );
  }

  return { sent: true, provider: 'stub' };
}
