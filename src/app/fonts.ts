import localFont from 'next/font/local';

// Self-hosted with next/font/local: files are bundled at build time, preloaded where they matter for
// the first paint, served from this app's own origin. See src/fonts/SOURCES.md for licences. Persian only: the pages use the system sans
// for Latin text (Tinos and Montserrat, never read by any page, were removed at the pre-go-live audit, H-17).
export const vazirmatn = localFont({
  src: [
    { path: '../fonts/vazirmatn-arabic-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/vazirmatn-arabic-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap', variable: '--font-vazirmatn', preload: false, fallback: ['system-ui', 'sans-serif'],
});
