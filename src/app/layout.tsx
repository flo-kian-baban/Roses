import type { Metadata } from 'next';
import { vazirmatn } from './fonts';
import './globals.css';

export const metadata: Metadata = { title: 'Menu', description: 'Menu' };

// No data-lang here: the language-toggle CSS (globals.css) applies to the public pages only; the admin shows both languages side by side.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={vazirmatn.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
