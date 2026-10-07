import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { title: 'Roses menu admin', robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: '#ffffff', width: 'device-width', initialScale: 1, viewportFit: 'cover' };
export const dynamic = 'force-dynamic';

// A public-only build (PREVIEW_BUILD=1) has no admin at all.
export default function AdminRoot({ children }: { children: React.ReactNode }) {
  if (process.env.PREVIEW_BUILD === '1') notFound();
  return <div className="admin min-h-screen bg-canvas text-ink">{children}</div>;
}
