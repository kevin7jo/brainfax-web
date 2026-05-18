import { timingSafeEqual } from 'crypto';
import { buildVerificationEmailContent } from './emailVerificationTemplate';
import { BFAX_HELP_FROM, getSmtpTransport, readSmtpConfigFromEnv } from './smtpTransport';
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

export type SendVerificationEmailResult = {
  sent: boolean;
  provider: 'nodemailer';
  messageId?: string;
};

/** Google SMTP(nodemailer)로 OTP 인증 메일 발송 */
export async function sendVerificationEmail(params: {
  to: string;
  code: string;
  expiresMinutes?: number;
}): Promise<SendVerificationEmailResult> {
  const expiresMinutes = params.expiresMinutes ?? OTP_TTL_MINUTES;
  const smtp = readSmtpConfigFromEnv();

  if (!smtp) {
    throw new Error(
      'SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD 환경 변수를 설정해 주세요.'
    );
  }

  const { subject, html, text } = buildVerificationEmailContent({
    code: params.code,
    expiresMinutes,
    to: params.to,
  });

  const transport = getSmtpTransport(smtp);
  const info = await transport.sendMail({
    from: `BrainFax <${BFAX_HELP_FROM}>`,
    to: params.to,
    replyTo: BFAX_HELP_FROM,
    subject,
    text,
    html,
  });

  return {
    sent: true,
    provider: 'nodemailer',
    messageId: info.messageId,
  };
}
