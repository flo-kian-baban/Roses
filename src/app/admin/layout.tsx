import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = { title: 'Roses menu admin', robots: { index: false, follow: false } };
// No theme colour of its own (the admin-wide clean-up, 2026-11-06: the admin's colours live in globals.css only): the browser takes the top bar's.
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };
export const dynamic = 'force-dynamic';

// (The PREVIEW_BUILD switch, which hid these pages but not the admin API, is removed: pre-go-live audit S1-10.)
export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <div className="admin min-h-screen bg-fill text-ink">{children}</div>; // white cards on the grey page (the admin-wide clean-up, 2026-11-06)
}
