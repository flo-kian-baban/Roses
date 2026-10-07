import type { Metadata } from 'next';
import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/600.css';
import './globals.css';

export const metadata: Metadata = { title: 'Menu', description: 'Menu' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
