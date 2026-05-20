import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { routing, type AppLocale } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

function getLocaleFromPathname(pathname: string): AppLocale {
  const first = pathname.split('/').filter(Boolean)[0];
  if (first && routing.locales.includes(first as AppLocale)) {
    return first as AppLocale;
  }
  return routing.defaultLocale;
}

/** Locale segment을 제외한 경로 (예: /ko/dashboard → /dashboard). /admin 차단 등에 사용 */
function pathnameWithoutLocale(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length > 0 && routing.locales.includes(segments[0] as AppLocale)) {
    const rest = segments.slice(1).join('/');
    return rest ? `/${rest}` : '/';
  }
  return pathname;
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const withoutLocale = pathnameWithoutLocale(pathname);
  const locale = getLocaleFromPathname(pathname);

  // 구 /admin 노출 차단 — 스텔스 경로만 사용 (locale 무관)
  if (withoutLocale === '/admin' || withoutLocale.startsWith('/admin/')) {
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }
  if (pathname === '/api/admin' || pathname.startsWith('/api/admin/')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  /**
   * next-intl 미들웨어: locale 라우팅·감지만 담당.
   * NextResponse를 재작성하지 않고 통과시키므로 Supabase 등 기존 요청 쿠키는 그대로 유지됩니다.
   */
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    // api, _next 정적, 파일 확장자, favicon 제외 — 인증·세션 쿠키가 불필요하게 건드려지지 않도록
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
