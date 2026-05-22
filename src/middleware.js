import { NextResponse } from 'next/server';
import { auth } from '@/auth';

// Gate /admin/** (UI) and /api/** (data plane) behind a Google sign-in. The
// public site (/, /tour/<slug>) reads from Prisma directly in server components,
// not via /api, so it's unaffected.
//
// /api/auth/* is intentionally excluded from the matcher — Auth.js needs those
// to remain reachable for the sign-in / callback dance itself.
export default auth((req) => {
  if (req.auth) return NextResponse.next();

  const path = req.nextUrl.pathname;
  if (path.startsWith('/api/')) {
    // Admin's fetch() calls should see a parsable JSON error rather than an
    // HTML redirect — let apiClient bubble it up as a normal Error.
    return Response.json(
      { error: 'unauthenticated', hint: 'sign in via /login' },
      { status: 401 }
    );
  }

  // /admin/** — bounce to /login with a ?from= so we can return them to
  // exactly where they were trying to go.
  const url = new URL('/login', req.nextUrl);
  url.searchParams.set('from', path);
  return NextResponse.redirect(url);
});

export const config = {
  // Negative lookahead skips /api/auth/* so Auth.js's own endpoints aren't
  // self-gated, plus skips Next's internals and static assets.
  matcher: ['/admin/:path*', '/api/((?!auth).*)'],
};
