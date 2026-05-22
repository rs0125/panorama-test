import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

// Email-domain allowlist. Sign-in is rejected for any address not ending in
// one of these — Google still authenticates the user but we refuse the token.
const ALLOWED_DOMAINS = ['wareongo.com'];

function isAllowed(email) {
  if (!email) return false;
  const at = email.lastIndexOf('@');
  if (at === -1) return false;
  const domain = email.slice(at + 1).toLowerCase();
  return ALLOWED_DOMAINS.includes(domain);
}

// JWT session strategy (default) so we don't need a Prisma adapter — the
// admin user set is small enough that we don't need to mirror Google accounts
// into our DB.
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      // Always show Google's account picker — without prompt=select_account,
      // Google silently re-uses the most recent session.
      //
      // We deliberately *don't* set `hd` (the Workspace-domain hint). It can
      // skip the picker when only one matching account is available, and the
      // signIn callback below is already the authoritative domain check.
      authorization: { params: { prompt: 'select_account' } },
    }),
  ],
  pages: { signIn: '/login' },
  callbacks: {
    // Final domain check — runs server-side after Google has authenticated.
    // Returning false aborts the sign-in and Auth.js redirects back to /login
    // with ?error=AccessDenied.
    async signIn({ profile, user }) {
      const email = profile?.email || user?.email;
      const verified = profile?.email_verified !== false; // Google sets this true for Workspace + most consumer accts
      return verified && isAllowed(email);
    },
    // Surface the email + name on the session object so server components can
    // read req.auth?.user.email without an extra DB lookup.
    async session({ session, token }) {
      if (session.user && token?.email) session.user.email = token.email;
      if (session.user && token?.name) session.user.name = token.name;
      if (session.user && token?.picture) session.user.image = token.picture;
      return session;
    },
  },
});
