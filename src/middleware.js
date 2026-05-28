import { NextResponse } from 'next/server';
import { auth } from '@/auth';

// Gate /admin/** (UI) and /api/** (data plane) behind a Google sign-in. The
// public site (/, /tour/<slug>) reads from Prisma directly in server components,
// not via /api, so it's unaffected.
//
// /api/auth/* is intentionally excluded from the matcher — Auth.js needs those
// to remain reachable for the sign-in / callback dance itself.
export default auth((req) => {
  const path = req.nextUrl.pathname;

  if (req.auth) {
    // Defence-in-depth CSRF check for /api/* mutating routes. NextAuth's
    // SameSite=Lax cookie already blocks most cross-origin POSTs, but PATCH/
    // DELETE have no equivalent default — verify Origin matches the request
    // host before letting an authenticated session change state.
    if (path.startsWith('/api/') && req.method !== 'GET' && req.method !== 'HEAD') {
      const origin = req.headers.get('origin');
      if (origin) {
        try {
          if (new URL(origin).host !== req.nextUrl.host) {
            return Response.json({ error: 'cross-origin request rejected' }, { status: 403 });
          }
        } catch {
          return Response.json({ error: 'invalid origin' }, { status: 400 });
        }
      }
    }
    return NextResponse.next();
  }

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
