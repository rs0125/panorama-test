'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// The tab pill — kept as its own client component so the parent Navbar can
// stay a server component (which is how it reads the auth session).
export default function NavTabs({ links }) {
  const pathname = usePathname() || '/';
  return (
    <div className="nav__tabs" role="tablist">
      {links.map((l) => {
        const active = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`nav__tab ${active ? 'is-active' : ''}`}
            role="tab"
            aria-selected={active}
          >
            {l.label}
          </Link>
        );
      })}
    </div>
  );
}
