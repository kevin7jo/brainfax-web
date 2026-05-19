import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 구 /admin 노출 차단 — 스텔스 경로만 사용
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (pathname === '/api/admin' || pathname.startsWith('/api/admin/')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Allow public pages and static files through
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.startsWith('/static') || pathname === '/login' || pathname.includes('.')) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|login).*)'],
};
