const KR_EMAIL_DOMAINS = [
  'naver.com',
  'daum.net',
  'hanmail.net',
  'kakao.com',
  'nate.com',
  'hanmir.com',
  'empal.com',
  'paran.com',
];

/** 수신 주소 도메인 기준 한국어 우선 여부 */
export function isKoreanLocaleEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  if (!domain) return true;
  if (domain.endsWith('.kr') || domain.includes('.co.kr')) return true;
  return KR_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHtmlBody(
  params: { code: string; expiresMinutes: number },
  koreanFirst: boolean
): string {
  const headlineKo = 'LocalBrain AI 이메일 연동 인증';
  const headlineEn = 'Your Security Verification Code';
  const leadKo = `아래 ${params.expiresMinutes}분 내 유효한 6자리 인증 코드를 대시보드에 입력해 주세요.`;
  const leadEn = `Enter this 6-digit code in your dashboard within ${params.expiresMinutes} minutes.`;

  return `<!DOCTYPE html>
<html lang="${koreanFirst ? 'ko' : 'en'}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BrainFax Verification</title>
</head>
<body style="margin:0;padding:0;background-color:#0B0F19;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0B0F19;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;border-radius:16px;border:1px solid #7c3aed;background:linear-gradient(145deg,#12101f 0%,#0B0F19 55%,#0f0a14 100%);box-shadow:0 0 40px rgba(124,58,237,0.35),0 0 80px rgba(236,72,153,0.15);">
          <tr>
            <td style="padding:36px 32px 24px;text-align:center;">
              <p style="margin:0;font-size:13px;letter-spacing:0.35em;text-transform:uppercase;color:#a78bfa;font-weight:700;">
                🧬 THE BRAINFAX UNIVERSE
              </p>
              <h1 style="margin:16px 0 0;font-size:22px;font-weight:800;color:#f8fafc;line-height:1.35;">
                ${koreanFirst ? headlineKo : headlineEn}
              </h1>
              <p style="margin:8px 0 0;font-size:14px;color:#94a3b8;font-weight:600;">
                ${koreanFirst ? headlineEn : headlineKo}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px;text-align:center;">
              <p style="margin:0 0 8px;font-size:14px;color:#cbd5e1;line-height:1.6;">${koreanFirst ? leadKo : leadEn}</p>
              <p style="margin:0 0 24px;font-size:13px;color:#64748b;line-height:1.5;">${koreanFirst ? leadEn : leadKo}</p>
              <div style="display:inline-block;padding:20px 28px;border-radius:12px;background:linear-gradient(135deg,#064e3b 0%,#022c22 100%);border:1px solid #10b981;box-shadow:0 0 28px rgba(16,185,129,0.45);">
                <span style="font-size:32px;font-weight:800;letter-spacing:0.45em;color:#6ee7b7;font-family:Consolas,'Courier New',monospace;padding-left:0.45em;">
                  ${escapeHtml(params.code)}
                </span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;text-align:center;border-top:1px solid rgba(124,58,237,0.25);">
              <p style="margin:20px 0 8px;font-size:12px;color:#64748b;line-height:1.65;">
                본 메일은 LocalBrain AI 컴퓨팅 엔진 보안 관리국에서 자동 발송되었습니다.<br />
                요청하지 않았다면 무시하세요.
              </p>
              <p style="margin:0;font-size:11px;color:#475569;line-height:1.55;">
                This message was sent automatically by the LocalBrain AI security operations center.<br />
                If you did not request this code, you may safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:20px 0 0;font-size:11px;color:#334155;">© BrainFax · bfax.help@brainfax.net</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildPlainText(
  params: { code: string; expiresMinutes: number },
  koreanFirst: boolean
): string {
  const lines = koreanFirst
    ? [
        'THE BRAINFAX UNIVERSE',
        'LocalBrain AI 이메일 연동 인증',
        'Your Security Verification Code',
        '',
        `인증 코드 (${params.expiresMinutes}분 유효): ${params.code}`,
        `Verification code (valid ${params.expiresMinutes} min): ${params.code}`,
        '',
        '본 메일은 LocalBrain AI 컴퓨팅 엔진 보안 관리국에서 자동 발송되었습니다.',
        'If you did not request this code, please ignore this email.',
      ]
    : [
        'THE BRAINFAX UNIVERSE',
        'Your Security Verification Code',
        'LocalBrain AI 이메일 연동 인증',
        '',
        `Verification code (valid ${params.expiresMinutes} min): ${params.code}`,
        `인증 코드 (${params.expiresMinutes}분 유효): ${params.code}`,
        '',
        'If you did not request this code, please ignore this email.',
        '본 메일은 LocalBrain AI 컴퓨팅 엔진 보안 관리국에서 자동 발송되었습니다.',
      ];
  return lines.join('\n');
}

export function buildVerificationEmailContent(params: {
  code: string;
  expiresMinutes: number;
  to: string;
}): { subject: string; html: string; text: string } {
  const koreanFirst = isKoreanLocaleEmail(params.to);

  const subject = koreanFirst
    ? `[BrainFax] 이메일 인증 코드 · Your Security Verification Code`
    : `[BrainFax] Your Security Verification Code · 이메일 인증 코드`;

  return {
    subject,
    html: buildHtmlBody(params, koreanFirst),
    text: buildPlainText(params, koreanFirst),
  };
}
