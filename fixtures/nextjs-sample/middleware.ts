import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const role = request.cookies.get('role')?.value;
  const { pathname } = request.nextUrl;

  if (!role) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  // 사용자 관리는 관리자만 접근할 수 있다.
  if (pathname.startsWith('/admin') && role !== 'admin') {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!login|_next|favicon.ico).*)'],
};
