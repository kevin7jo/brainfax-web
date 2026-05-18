import { NextResponse } from 'next/server';
import { createServiceClient } from '../../../../../lib/supabaseAdmin';
import {
  OTP_LENGTH,
  isOtpExpired,
  isValidEmail,
  normalizeEmail,
  safeOtpCompare,
} from '../../../../../lib/userEmails';
import { findUserEmailForVerification, markUserEmailVerified } from '../../../../../lib/userEmailsDb';
import { verifyUserRequest } from '../../../../../lib/verifyUserRequest';

type VerifyBody = {
  email?: string;
  code?: string;
};

export async function POST(request: Request) {
  const auth = await verifyUserRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const db = createServiceClient();
  if (!db) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.' },
      { status: 503 }
    );
  }

  let body: VerifyBody;
  try {
    body = (await request.json()) as VerifyBody;
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다.' }, { status: 400 });
  }

  const rawEmail = body?.email;
  const rawCode = body?.code;

  if (!rawEmail || typeof rawEmail !== 'string') {
    return NextResponse.json({ error: '이메일 주소가 필요합니다.' }, { status: 400 });
  }
  if (!rawCode || typeof rawCode !== 'string') {
    return NextResponse.json({ error: '인증 코드가 필요합니다.' }, { status: 400 });
  }

  const code = rawCode.trim().replace(/\D/g, '');
  if (code.length !== OTP_LENGTH) {
    return NextResponse.json({ error: '6자리 숫자 인증 코드를 입력하세요.' }, { status: 400 });
  }

  if (!isValidEmail(rawEmail)) {
    return NextResponse.json({ error: '유효한 이메일 형식이 아닙니다.' }, { status: 400 });
  }

  const email = normalizeEmail(rawEmail);

  try {
    const row = await findUserEmailForVerification(db, {
      userId: auth.userId,
      email,
    });

    if (!row) {
      return NextResponse.json(
        { error: '인증 요청 내역이 없습니다. 먼저 인증 메일을 발송하세요.' },
        { status: 404 }
      );
    }

    if (row.is_verified) {
      return NextResponse.json({
        ok: true,
        alreadyVerified: true,
        email: row.email,
        message: '이미 인증된 이메일입니다.',
      });
    }

    if (isOtpExpired(row.code_expires_at)) {
      return NextResponse.json(
        { error: '인증 코드가 만료되었습니다. 인증 메일을 다시 발송하세요.' },
        { status: 410 }
      );
    }

    if (!safeOtpCompare(code, row.verification_code)) {
      return NextResponse.json({ error: '인증 코드가 일치하지 않습니다.' }, { status: 401 });
    }

    const verified = await markUserEmailVerified(db, {
      userId: auth.userId,
      email,
    });

    return NextResponse.json({
      ok: true,
      email: verified.email,
      is_verified: verified.is_verified,
      message: '이메일 연동이 완료되었습니다.',
    });
  } catch (err) {
    console.error('[emails/verify]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '인증 처리에 실패했습니다.' },
      { status: 500 }
    );
  }
}
