import Link from 'next/link';
import { auth, signOut } from '@/auth';
import NavTabs from './NavTabs.jsx';

const LINKS = [
  { href: '/', label: 'Tours' },
  { href: '/admin', label: 'Admin' },
];

// A small custom monogram in place of the placeholder ◐: a filled disc with
// a horizon-line stroke and a focal dot — a glance-readable nod to "360
// panorama platform". The gradient id is namespaced so it can't collide with
// other inline SVGs on the page.
function BrandMark() {
  return (
    <svg className="nav__mark" viewBox="0 0 28 28" aria-hidden="true">
      <defs>
        <linearGradient id="wg-nav-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffb074" />
          <stop offset="100%" stopColor="#ff6e29" />
        </linearGradient>
      </defs>
      <circle cx="14" cy="14" r="12" fill="url(#wg-nav-mark)" />
      <path
        d="M3 14 Q14 8 25 14"
        fill="none"
        stroke="rgba(255,255,255,0.85)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="14" cy="14" r="2.4" fill="#fff" />
    </svg>
  );
}

// Server component — fetches session so the user chip + sign-out are present
// only when authenticated. The tab pill is a small client component (it needs
// usePathname for the active state).
export default async function Navbar() {
  const session = await auth();
  const user = session?.user;

  async function doSignOut() {
    'use server';
    await signOut({ redirectTo: '/' });
  }

  return (
    <nav className="nav">
      <Link href="/" className="nav__brand" aria-label="Wareongo home">
        <BrandMark />
        <span className="nav__brand-text">Wareongo</span>
      </Link>

      <div className="nav__right">
        <NavTabs links={LINKS} />

        {user ? (
          <form action={doSignOut} className="nav__user">
            <span className="nav__user-email" title={user.email}>
              {user.email}
            </span>
            <button type="submit" className="nav__user-out" aria-label="Sign out">
              Sign out
            </button>
          </form>
        ) : (
          <Link href="/login" className="nav__signin">
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
