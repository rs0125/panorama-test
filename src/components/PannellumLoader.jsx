'use client';

import Script from 'next/script';

// Pannellum CDN bundle (~200 KB). Loaded lazily and only on routes that
// actually mount a viewer — homepage, /login, and the admin tour list don't
// need it. next/script dedupes by `id`, so multiple Pannellum-using
// components on the same page still trigger one fetch.
export default function PannellumLoader() {
  return (
    <Script
      id="pannellum-js"
      src="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js"
      strategy="lazyOnload"
      integrity="sha384-S5+w/JlcNAOymqXGNrvzn2F++XsaHTJdex6KE5VbKryfFgqJiRUJOgOkUqaiOZTf"
      crossOrigin="anonymous"
    />
  );
}
