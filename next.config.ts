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
};

export default nextConfig;
