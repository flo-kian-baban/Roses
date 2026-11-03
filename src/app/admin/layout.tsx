import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = { title: 'Roses menu admin', robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: '#ffffff', width: 'device-width', initialScale: 1, viewportFit: 'cover' };
export const dynamic = 'force-dynamic';

// (The PREVIEW_BUILD switch, which hid these pages but not the admin API, is removed: pre-go-live audit S1-10.)
export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <div className="admin min-h-screen bg-canvas text-ink">{children}</div>;
}
