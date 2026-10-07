import type { Metadata } from 'next';
import { montserrat, tinos, vazirmatn } from './fonts';
import './globals.css';

export const metadata: Metadata = { title: 'Menu', description: 'Menu' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-lang="en" className={`${tinos.variable} ${montserrat.variable} ${vazirmatn.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
