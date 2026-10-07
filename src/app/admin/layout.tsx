import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { title: 'Menu admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// A public-only build (PREVIEW_BUILD=1) has no admin at all.
export default function AdminRoot({ children }: { children: React.ReactNode }) {
  if (process.env.PREVIEW_BUILD === '1') notFound();
  return <div className="min-h-screen bg-neutral-50 text-neutral-900">{children}</div>;
}
