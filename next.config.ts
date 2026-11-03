import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Photos are linked from the venues' own hosts for the MVP and served as plain <img>; no optimizer.
  images: { unoptimized: true },
  // No "standalone" output for the MVP: the app runs with `next start` (Next 16 warns that standalone and `next start`
  // do not go together). A standalone bundle can be switched on when a host needs one.
  // The check suite builds into .next-check (NEXT_DIST_DIR) so a running production server and its .next are untouched.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  // pg is loaded by Node at build/run time, never bundled (its optional Cloudflare socket module cannot be resolved by a bundler).
  serverExternalPackages: ['pg'],
  // Uploaded photos and logos (local disk behind src/lib/storage.ts) are served by an API route under their public address.
  async rewrites() { return [{ source: '/uploads/:path*', destination: '/api/uploads/:path*' }]; },
  // Security headers (pre-go-live audit S1-08 and S2-10, the PM's fix batch of 2026-11-03). Every response: no type sniffing, the referrer
  // as an origin only to other sites, HTTPS remembered for a year (browsers ignore it over plain http, so the laptop is unaffected), no
  // camera, microphone, location or payment. The admin: never inside another site's frame, forms posting to the app only. The customers'
  // pages: framed by the app only (the admin's preview); their script policy is a <meta> written with each page (src/lib/csp.ts), since it
  // follows the page's own scripts. One rule per header key and path: Next.js lets a later match override an earlier one.
  async headers() {
    const common = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
    ];
    const admin = [
      { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
      { key: 'X-Frame-Options', value: 'DENY' },
    ];
    return [
      { source: '/:path*', headers: common },
      { source: '/admin', headers: admin },
      { source: '/admin/:path*', headers: admin },
      { source: '/api/admin/:path*', headers: admin },
      { source: '/:path((?!admin(?:/|$)|api/|uploads/|_next/).*)', headers: [{ key: 'Content-Security-Policy', value: "frame-ancestors 'self'; base-uri 'none'; object-src 'none'" }, { key: 'X-Frame-Options', value: 'SAMEORIGIN' }] },
    ];
  },
};

export default nextConfig;
