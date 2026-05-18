import { NextResponse } from 'next/server';
import { createServiceClient } from '../../../../../lib/supabaseAdmin';
import { isValidEmail, normalizeEmail, sendVerificationEmail } from '../../../../../lib/userEmails';
import { upsertPendingUserEmail } from '../../../../../lib/userEmailsDb';
import { verifyUserRequest } from '../../../../../lib/verifyUserRequest';

type RequestBody = {
  email?: string;
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

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않습니다.' }, { status: 400 });
  }

  const rawEmail = body?.email;
  if (!rawEmail || typeof rawEmail !== 'string') {
    return NextResponse.json({ error: '이메일 주소가 필요합니다.' }, { status: 400 });
  }

  if (!isValidEmail(rawEmail)) {
    return NextResponse.json({ error: '유효한 이메일 형식이 아닙니다.' }, { status: 400 });
  }

  const email = normalizeEmail(rawEmail);

  if (email === normalizeEmail(auth.email)) {
    return NextResponse.json(
      { error: '로그인 계정 이메일은 소셜 로그인으로 이미 인증되어 있습니다.' },
      { status: 400 }
    );
  }

  try {
    const { row, otp, expiresAt } = await upsertPendingUserEmail(db, {
      userId: auth.userId,
      email,
    });

    const mailResult = await sendVerificationEmail({ to: email, code: otp });

    return NextResponse.json({
      ok: true,
      email: row.email,
      expiresAt,
      message: `${email}(으)로 6자리 인증 코드를 발송했습니다.`,
      delivery: mailResult,
    });
  } catch (err) {
    console.error('[emails/request]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '인증 메일 요청에 실패했습니다.' },
      { status: 500 }
    );
  }
}
