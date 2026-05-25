/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Allow third-party sites to <iframe> tour pages. Tours are public anyway
  // (the /tour/* route is excluded from auth middleware), so opening framing
  // up doesn't expose anything new — it just unblocks the legitimate embed
  // use-case where a client pastes our snippet onto their own website.
  //
  // The default for Next.js is no X-Frame-Options header at all, but some
  // hosting providers inject one; CSP frame-ancestors supersedes it where
  // both are present and is the modern way to control framing.
  async headers() {
    return [
      {
        source: '/tour/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: 'frame-ancestors *;' },
        ],
      },
    ];
  },
};

export default nextConfig;
