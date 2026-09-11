import { NextResponse } from 'next/server';

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

export default function middleware(req) {
  const url = req.nextUrl;
  
  // Get hostname of request (e.g. admin.nirikshan.com, localhost:3000)
  const hostname = req.headers.get('host') || '';
  
  // If we're on the admin/officer subdomain
  if (hostname.startsWith('admin.') || hostname.startsWith('officer.')) {
    // If they hit the root of the admin domain, rewrite to the officer portal root
    if (url.pathname === '/') {
      return NextResponse.rewrite(new URL('/officer', req.url));
    }
    
    // If they hit other paths (like /login or /dashboard) that don't start with /officer
    // we can rewrite them to /officer/... so the URL stays clean.
    // However, if the app uses explicit router.push('/officer/login'), it will still work.
    if (!url.pathname.startsWith('/officer')) {
       return NextResponse.rewrite(new URL(`/officer${url.pathname}`, req.url));
    }
  }

  return NextResponse.next();
}
