import { signIn, auth } from '@/auth';
import { redirect } from 'next/navigation';
import PageShell from '@/components/PageShell.jsx';

export const metadata = { title: 'Sign in · Wareongo' };

// If the user is already signed in, bounce straight to where they were
// headed (or /admin by default).
export default async function LoginPage({ searchParams }) {
  const sp = await searchParams;
  const from = typeof sp?.from === 'string' && sp.from.startsWith('/') ? sp.from : '/admin';
  const error = typeof sp?.error === 'string' ? sp.error : null;

  const session = await auth();
  if (session?.user) redirect(from);

  async function googleSignIn() {
    'use server';
    // signIn() throws a Next redirect to Google's consent screen — Auth.js
    // handles the callback back into /api/auth/callback/google.
    await signIn('google', { redirectTo: from });
  }

  return (
    <PageShell>
      <div className="auth-shell">
        <div className="auth-card">
          <h1 className="auth-card__title">Sign in</h1>
          <p className="auth-card__subtitle">
            Wareongo admin · @wareongo.com Google accounts only.
          </p>

          {error === 'AccessDenied' && (
            <div className="auth-card__error">
              That account isn't authorised. Sign in with a @wareongo.com address.
            </div>
          )}

          <form action={googleSignIn}>
            <button type="submit" className="auth-card__btn">
              <GoogleGlyph />
              Continue with Google
            </button>
          </form>
        </div>
      </div>
    </PageShell>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#EA4335" d="M9 3.48c1.69 0 2.84.73 3.49 1.34l2.55-2.49C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.97 2.3C4.7 5.06 6.66 3.48 9 3.48z"/>
      <path fill="#4285F4" d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.1.83-.64 2.08-1.84 2.92l2.83 2.2c1.7-1.57 2.69-3.88 2.69-6.62z"/>
      <path fill="#FBBC05" d="M3.94 10.74A5.4 5.4 0 0 1 3.66 9c0-.6.1-1.18.28-1.74L.96 4.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.98-2.3z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.83-2.2c-.76.53-1.78.9-3.13.9-2.34 0-4.32-1.58-5.03-3.78L.97 13.04C2.45 15.98 5.48 18 9 18z"/>
    </svg>
  );
}
